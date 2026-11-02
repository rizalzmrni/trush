import { z } from "zod";

/** Driver `@trush/email`: `memory` (e2e), `log` (dev tanpa kunci), `resend`. */
export const EMAIL_DRIVERS = ["memory", "log", "resend"] as const;

export type EmailDriverName = (typeof EMAIL_DRIVERS)[number];

/** Bagian alamat `nama@domain` (sengaja longgar; Resend memvalidasi ulang). */
const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u;
/** `nama@domain` atau `Nama Tampilan <nama@domain>`. */
const SENDER =
  /^(?:[^<>]+<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/u;
/** Satu domain penuh, diawali `@`, mis. `@example.com`. */
const DOMAIN_ENTRY = /^@(?:[a-z0-9-]+\.)+[a-z]{2,}$/u;

/** Entri allowlist: alamat persis atau `@domain`; huruf kecil. */
const allowlistEntrySchema = z
  .string()
  .transform((value) => value.toLowerCase())
  .refine(
    (value) => ADDRESS.test(value) || DOMAIN_ENTRY.test(value),
    "harus alamat email atau @domain, mis. tim@example.com atau @example.com"
  );

/** Daftar dipisah koma, spasi diabaikan, entri kosong dibuang. */
const allowlistSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  )
  .pipe(z.array(allowlistEntrySchema));

/** Skema server var email; disebar ke skema `createApiEnv`. */
export const emailServerSchema = {
  /**
   * Default `log` (bukan secret): di luar development dan saat `E2E=true`
   * nilai ini ditolak keras, jadi staging/production wajib mengisinya.
   */
  EMAIL_DRIVER: z.enum(EMAIL_DRIVERS).default("log"),
  /**
   * Pengirim, mis. `trush <noreply@mail.example.com>`. Domainnya wajib
   * terverifikasi di Resend; wajib untuk driver `resend`.
   */
  EMAIL_FROM: z
    .string()
    .trim()
    .regex(SENDER, "harus alamat email atau `Nama <alamat@domain>`")
    .optional(),
  /**
   * Penerima yang boleh dikirimi (alamat persis atau `@domain`), dipisah
   * koma. Wajib saat staging + `resend`; kosong = semua alamat.
   */
  EMAIL_ALLOWLIST: allowlistSchema.optional(),
  /** Secret. Kunci API Resend (driver `resend`). */
  RESEND_API_KEY: z.string().min(1).optional(),
};

interface EmailEnvShape {
  APP_ENV: string;
  EMAIL_DRIVER: EmailDriverName;
  EMAIL_FROM?: string | undefined;
  EMAIL_ALLOWLIST?: string[] | undefined;
  RESEND_API_KEY?: string | undefined;
}

/**
 * Driver lokal (tanpa penyedia) hanya sah di development: `log` mencetak
 * kode/tautan, `memory` menyimpannya di outbox yang bisa dibaca.
 */
const DEVELOPMENT_ONLY_DRIVERS: ReadonlySet<EmailDriverName> = new Set([
  "log",
  "memory",
]);

/**
 * Aturan lintas var email. Pesan hanya memuat nama var, bukan nilainya.
 * `E2E=true` → `EMAIL_DRIVER=memory` ditegakkan `createApiEnv` (`api.ts`).
 */
export const assertEmailEnv = (env: EmailEnvShape): void => {
  if (env.APP_ENV === "production" && env.EMAIL_DRIVER !== "resend") {
    throw new Error("EMAIL_DRIVER wajib resend saat APP_ENV=production.");
  }
  if (
    env.APP_ENV !== "development" &&
    DEVELOPMENT_ONLY_DRIVERS.has(env.EMAIL_DRIVER)
  ) {
    throw new Error(
      `EMAIL_DRIVER=${env.EMAIL_DRIVER} hanya sah saat APP_ENV=development.`
    );
  }
  if (env.EMAIL_DRIVER === "resend") {
    const missing = (["EMAIL_FROM", "RESEND_API_KEY"] as const).filter(
      (key) => env[key] === undefined
    );
    if (missing.length > 0) {
      throw new Error(`EMAIL_DRIVER=resend butuh: ${missing.join(", ")}.`);
    }
  }
  const hasAllowlist = (env.EMAIL_ALLOWLIST?.length ?? 0) > 0;
  if (
    env.APP_ENV === "staging" &&
    env.EMAIL_DRIVER === "resend" &&
    !hasAllowlist
  ) {
    throw new Error(
      "EMAIL_ALLOWLIST wajib diisi saat APP_ENV=staging dengan EMAIL_DRIVER=resend."
    );
  }
};
