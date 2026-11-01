import { newId } from "@trush/db";
import type { AnyDatabase } from "@trush/db";
import * as schema from "@trush/db/schema";
import type { ApiEnv } from "@trush/env/api";
import { createPhoneSender } from "@trush/phone";
import type { PhoneEnv, PhoneLogger, PhoneSender } from "@trush/phone";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  admin,
  captcha,
  haveIBeenPwned,
  lastLoginMethod,
  multiSession,
  openAPI,
  organization,
  phoneNumber,
  twoFactor,
  username,
} from "better-auth/plugins";

import {
  createSendOtp,
  createSendPasswordResetOtp,
  phoneBeforeHook,
} from "./phone";

/** Path handler better-auth di `apps/api`. */
export const AUTH_BASE_PATH = "/api/auth";

/**
 * Endpoint ber-captcha. Ditulis eksplisit karena opsi ini mengganti daftar
 * bawaan; cocokkan dengan versi better-auth setiap upgrade. Tambahkan
 * `/email-otp/send-verification-otp` saat plugin `emailOTP` dipasang.
 * Varian login lain (`/sign-in/username`, `/sign-in/phone-number`) dan
 * pengirim OTP reset (`/phone-number/request-password-reset`) ikut agar
 * captcha tidak bisa dilewati lewat jalur lain.
 */
export const CAPTCHA_ENDPOINTS = [
  "/sign-up/email",
  "/sign-in/email",
  "/sign-in/username",
  "/sign-in/phone-number",
  "/request-password-reset",
  "/phone-number/send-otp",
  "/phone-number/request-password-reset",
];

const MINUTE_SECONDS = 60;

/**
 * Batas ketat per IP (`cf-connecting-ip`) untuk endpoint sensitif. Aturan
 * phone-number/email-otp sudah dipasang agar berlaku begitu plugin-nya aktif.
 */
const RATE_LIMIT_RULES = {
  "/sign-in/*": { max: 5, window: MINUTE_SECONDS },
  "/sign-up/*": { max: 3, window: MINUTE_SECONDS },
  "/request-password-reset": { max: 3, window: MINUTE_SECONDS },
  "/two-factor/*": { max: 5, window: MINUTE_SECONDS },
  "/phone-number/*": { max: 3, window: MINUTE_SECONDS },
  "/email-otp/*": { max: 3, window: MINUTE_SECONDS },
};

/** Bagian env api yang dibaca better-auth; semuanya dari `createApiEnv`. */
export type AuthEnv = Pick<
  ApiEnv,
  | "APP_ENV"
  | "AUTH_COOKIE_DOMAIN"
  | "BETTER_AUTH_SECRET"
  | "BETTER_AUTH_URL"
  | "CORS_ORIGINS"
  | "TURNSTILE_SECRET_KEY"
> &
  PhoneEnv;

export interface CreateAuthOptions {
  /** Klien per request dari `createDb`; auth tidak membuka koneksi sendiri. */
  db: AnyDatabase;
  env: AuthEnv;
  /** Logger untuk driver `log` `@trush/phone` (development). */
  phoneLogger?: PhoneLogger | undefined;
  /** Pengganti pengirim OTP (test); default `createPhoneSender` dari env. */
  phoneSender?: PhoneSender | undefined;
}

/**
 * Instance better-auth per request (secret baru ada di binding Workers saat
 * request masuk). `auth.cli.ts` memanggil factory ini juga, jadi plugin untuk
 * CLI dan runtime selalu sama.
 */
export const createAuth = ({
  db,
  env,
  phoneLogger,
  phoneSender = createPhoneSender({ env, logger: phoneLogger }),
}: CreateAuthOptions) => {
  const phonePlugin = phoneNumber({
    // Ditolak (400 INVALID_PHONE_NUMBER) sebelum OTP dibuat: nomor tidak
    // valid, negara di luar PHONE_ALLOWED_COUNTRIES, atau di luar allowlist.
    phoneNumberValidator: (phone) => phoneSender.canSendTo(phone),
    // Sinkron: error Twilio → 4xx kode domain / 502 OTP_DELIVERY_FAILED.
    // Hanya untuk pengguna login (menambah nomor); login OTP mati.
    sendOTP: createSendOtp(phoneSender),
    sendPasswordResetOTP: createSendPasswordResetOtp(phoneSender),
  });
  return betterAuth({
    advanced: {
      // Sengaja tanpa `backgroundTasks`: plugin phoneNumber akan mengirim OTP
      // di latar bila diisi, padahal error kirim harus sampai ke pengguna.
      // Tugas latar lain better-auth jadi ditunggu sebelum respons.
      crossSubDomainCookies: env.AUTH_COOKIE_DOMAIN
        ? { domain: env.AUTH_COOKIE_DOMAIN, enabled: true }
        : undefined,
      database: { generateId: () => newId() },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      },
      // Hanya header yang dipasang Cloudflare; `x-forwarded-for` bisa dipalsukan.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      useSecureCookies: true,
    },
    appName: "trush",
    basePath: AUTH_BASE_PATH,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    // Nomor di body → E.164; login OTP dan phoneNumber di sign-up ditolak;
    // nomor tak terdaftar/belum terverifikasi tidak membocorkan keberadaannya.
    hooks: {
      before: phoneBeforeHook({
        errors: phonePlugin.$ERROR_CODES,
        phoneSender,
      }),
    },
    emailAndPassword: {
      enabled: true,
      // WAJIB diubah ke `true` (plus `emailVerification.sendVerificationEmail`)
      // begitu `@trush/email` siap; sementara akun baru langsung aktif.
      requireEmailVerification: false,
    },
    plugins: [
      organization(),
      admin(),
      twoFactor(),
      username(),
      haveIBeenPwned(),
      lastLoginMethod(),
      multiSession(),
      phonePlugin,
      // Referensi bawaan memuat skrip Scalar tanpa pin; skemanya digabung ke
      // `/docs` api lewat `/api/auth/open-api/generate-schema`.
      openAPI({ disableDefaultReference: true }),
      captcha({
        endpoints: CAPTCHA_ENDPOINTS,
        provider: "cloudflare-turnstile",
        secretKey: env.TURNSTILE_SECRET_KEY,
      }),
    ],
    rateLimit: {
      customRules: RATE_LIMIT_RULES,
      // Memori tidak berlaku lintas isolate Workers.
      enabled: env.APP_ENV !== "development",
      storage: "database",
    },
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.CORS_ORIGINS,
  });
};

export type Auth = ReturnType<typeof createAuth>;

/** `{ session, user }` hasil `auth.api.getSession`. */
export type AuthSession = Auth["$Infer"]["Session"];
