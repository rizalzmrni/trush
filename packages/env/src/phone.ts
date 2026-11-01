import { z } from "zod";

/** Driver `@trush/phone` (lihat `docs/adr/0001-phone-provider.md`). */
export const PHONE_DRIVERS = [
  "memory",
  "log",
  "twilio-test",
  "twilio",
] as const;

export type PhoneDriverName = (typeof PHONE_DRIVERS)[number];

const COUNTRY_CODE = /^[A-Z]{2}$/u;
const E164 = /^\+[1-9]\d{6,14}$/u;

/** Daftar dipisah koma, spasi diabaikan, entri kosong dibuang. */
const commaList = (item: z.ZodString) =>
  z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
    .pipe(z.array(item));

/** Skema server var telepon; disebar ke skema `createApiEnv`. */
export const phoneServerSchema = {
  PHONE_DRIVER: z.enum(PHONE_DRIVERS),
  /** Kode negara ISO 3166-1 alpha-2, mis. `ID,MY`. Entri pertama = negara default nomor lokal. */
  PHONE_ALLOWED_COUNTRIES: commaList(
    z.string().regex(COUNTRY_CODE, "harus kode negara ISO 2 huruf kapital")
  )
    .pipe(z.array(z.string()).min(1))
    .default(["ID"]),
  /** Nomor E.164 tim yang boleh dikirimi saat staging, mis. `+6281234567890`. */
  PHONE_ALLOWLIST: commaList(
    z.string().regex(E164, "harus nomor E.164, mis. +6281234567890")
  ).optional(),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_API_KEY_SID: z.string().min(1).optional(),
  /** Secret. */
  TWILIO_API_KEY_SECRET: z.string().min(1).optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().min(1).optional(),
  TWILIO_WHATSAPP_OTP_CONTENT_SID: z.string().min(1).optional(),
  /** Test credentials Twilio (driver `twilio-test`); API Key tidak berlaku di sana. */
  TWILIO_TEST_ACCOUNT_SID: z.string().min(1).optional(),
  /** Secret. */
  TWILIO_TEST_AUTH_TOKEN: z.string().min(1).optional(),
};

interface PhoneEnvShape {
  APP_ENV: string;
  PHONE_DRIVER: PhoneDriverName;
  PHONE_ALLOWLIST?: string[] | undefined;
  TWILIO_ACCOUNT_SID?: string | undefined;
  TWILIO_API_KEY_SID?: string | undefined;
  TWILIO_API_KEY_SECRET?: string | undefined;
  TWILIO_MESSAGING_SERVICE_SID?: string | undefined;
  TWILIO_WHATSAPP_OTP_CONTENT_SID?: string | undefined;
  TWILIO_TEST_ACCOUNT_SID?: string | undefined;
  TWILIO_TEST_AUTH_TOKEN?: string | undefined;
}

const REQUIRED_BY_DRIVER: Readonly<
  Partial<Record<PhoneDriverName, readonly (keyof PhoneEnvShape)[]>>
> = {
  twilio: [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_API_KEY_SID",
    "TWILIO_API_KEY_SECRET",
    "TWILIO_MESSAGING_SERVICE_SID",
    "TWILIO_WHATSAPP_OTP_CONTENT_SID",
  ],
  "twilio-test": ["TWILIO_TEST_ACCOUNT_SID", "TWILIO_TEST_AUTH_TOKEN"],
};

/**
 * Driver lokal (tanpa penyedia) hanya sah di development: `log` mencetak
 * kode OTP, `memory` menyimpannya di outbox yang bisa dibaca.
 */
const DEVELOPMENT_ONLY_DRIVERS: ReadonlySet<PhoneDriverName> = new Set([
  "log",
  "memory",
]);

/**
 * Aturan lintas var telepon. Pesan hanya memuat nama var, bukan nilainya.
 * TODO(B8): `E2E=true` mewajibkan `PHONE_DRIVER=memory` (dan menjadi satu-
 * satunya pengecualian `memory` di luar development bila B8 memutuskannya).
 */
export const assertPhoneEnv = (env: PhoneEnvShape): void => {
  if (env.APP_ENV === "production" && env.PHONE_DRIVER !== "twilio") {
    throw new Error("PHONE_DRIVER wajib twilio saat APP_ENV=production.");
  }
  if (
    env.APP_ENV !== "development" &&
    DEVELOPMENT_ONLY_DRIVERS.has(env.PHONE_DRIVER)
  ) {
    throw new Error(
      `PHONE_DRIVER=${env.PHONE_DRIVER} hanya sah saat APP_ENV=development.`
    );
  }
  const missing = (REQUIRED_BY_DRIVER[env.PHONE_DRIVER] ?? []).filter(
    (key) => env[key] === undefined
  );
  if (missing.length > 0) {
    throw new Error(
      `PHONE_DRIVER=${env.PHONE_DRIVER} butuh: ${missing.join(", ")}.`
    );
  }
  const hasAllowlist = (env.PHONE_ALLOWLIST?.length ?? 0) > 0;
  if (
    env.APP_ENV === "staging" &&
    env.PHONE_DRIVER === "twilio" &&
    !hasAllowlist
  ) {
    throw new Error(
      "PHONE_ALLOWLIST wajib diisi saat APP_ENV=staging dengan PHONE_DRIVER=twilio."
    );
  }
};
