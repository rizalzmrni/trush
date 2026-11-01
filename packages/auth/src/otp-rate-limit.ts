import type { AnyDatabase } from "@trush/db";
import { otpRateLimit } from "@trush/db/schema";
import { APIError } from "better-auth/api";
import { lt, sql } from "drizzle-orm";

const HOUR_SECONDS = 3600;
const MS_PER_SECOND = 1000;

/** Satu aturan jendela tetap: `max` permintaan per `windowSeconds`. */
export interface OtpRateRule {
  max: number;
  windowSeconds: number;
}

/**
 * Batas permintaan OTP (B7c), melengkapi batas per IP better-auth
 * (`/phone-number/*` 3/menit). Per nomor menahan SMS pumping ke satu nomor
 * dari banyak IP; per pengguna menahan satu akun yang berganti-ganti nomor.
 */
export const OTP_RATE_RULES = {
  phone: { max: 5, windowSeconds: HOUR_SECONDS },
  user: { max: 10, windowSeconds: HOUR_SECONDS },
} as const satisfies Record<string, OtpRateRule>;

/** Baris lebih tua dari jendela terpanjang tidak lagi berpengaruh. */
const LONGEST_WINDOW_SECONDS = Math.max(
  ...Object.values(OTP_RATE_RULES).map((rule) => rule.windowSeconds)
);

export const OTP_RATE_LIMITED = {
  code: "OTP_RATE_LIMITED",
  message: "Terlalu banyak permintaan kode. Coba lagi nanti.",
} as const;

export const otpPhoneKey = (phoneNumber: string): string =>
  `otp:phone:${phoneNumber}`;

export const otpUserKey = (userId: string): string => `otp:user:${userId}`;

export interface OtpQuotaRequest {
  key: string;
  rule: OtpRateRule;
}

export interface OtpRateLimiter {
  /** Menghitung semua kunci berurutan; 429 `OTP_RATE_LIMITED` pada yang pertama habis. */
  consume: (requests: readonly OtpQuotaRequest[]) => Promise<void>;
}

/** Kolom tabel target (baris lama) di `ON CONFLICT DO UPDATE`, ditulis lengkap. */
const existing = (column: "count" | "window_start") =>
  sql`${sql.identifier("otp_rate_limit")}.${sql.identifier(column)}`;

/**
 * Penghitung di Postgres (tabel `otp_rate_limit`), berlaku lintas isolate.
 * Satu upsert atomik per kunci: jendela kedaluwarsa → hitungan mulai dari 1,
 * selain itu bertambah. Waktu diambil dari `now()` database.
 */
export const createOtpRateLimiter = (db: AnyDatabase): OtpRateLimiter => {
  const consumeOne = async ({ key, rule }: OtpQuotaRequest): Promise<void> => {
    const expired = sql`${existing("window_start")} <= now() - make_interval(secs => ${rule.windowSeconds})`;
    const [row] = await db
      .insert(otpRateLimit)
      .values({ count: 1, key, windowStart: sql`now()` })
      .onConflictDoUpdate({
        set: {
          count: sql`CASE WHEN ${expired} THEN 1 ELSE ${existing("count")} + 1 END`,
          windowStart: sql`CASE WHEN ${expired} THEN now() ELSE ${existing("window_start")} END`,
        },
        target: otpRateLimit.key,
      })
      .returning({
        count: otpRateLimit.count,
        windowStart: otpRateLimit.windowStart,
      });
    if (row === undefined) {
      throw new Error("Upsert otp_rate_limit tidak mengembalikan baris.");
    }
    if (row.count === 1) {
      // Jendela baru: sekalian buang baris basi agar tabel tidak tumbuh.
      await db
        .delete(otpRateLimit)
        .where(
          lt(
            otpRateLimit.windowStart,
            sql`now() - make_interval(secs => ${LONGEST_WINDOW_SECONDS})`
          )
        );
    }
    if (row.count <= rule.max) {
      return;
    }
    const resetAt =
      row.windowStart.getTime() + rule.windowSeconds * MS_PER_SECOND;
    const retryAfter = Math.max(
      1,
      Math.ceil((resetAt - Date.now()) / MS_PER_SECOND)
    );
    throw new APIError("TOO_MANY_REQUESTS", OTP_RATE_LIMITED, {
      "Retry-After": String(retryAfter),
    });
  };
  // Berurutan (rekursif): kunci berikutnya tidak dihitung bila yang ini habis.
  const consume = async ([
    first,
    ...rest
  ]: readonly OtpQuotaRequest[]): Promise<void> => {
    if (first === undefined) {
      return;
    }
    await consumeOne(first);
    await consume(rest);
  };
  return { consume };
};
