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

import { normalizePhoneBody, otpChannelFrom } from "./phone";

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
  /** `executionCtx.waitUntil` agar tugas latar tidak dibatalkan runtime. */
  waitUntil?: (promise: Promise<unknown>) => void;
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
  waitUntil,
}: CreateAuthOptions) =>
  betterAuth({
    advanced: {
      backgroundTasks: waitUntil ? { handler: waitUntil } : undefined,
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
    // Nomor di body disimpan & dicari dalam bentuk E.164 (`0812…` → `+62812…`).
    hooks: { before: normalizePhoneBody(phoneSender) },
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
      phoneNumber({
        // Ditolak (400 INVALID_PHONE_NUMBER) sebelum OTP dibuat: nomor tidak
        // valid, negara di luar PHONE_ALLOWED_COUNTRIES, atau di luar allowlist.
        phoneNumberValidator: (phone) => phoneSender.canSendTo(phone),
        // Dengan `backgroundTasks`, better-auth menjalankan pengiriman lewat
        // waitUntil: error penyedia hanya di-log, respons tetap "code sent".
        sendOTP: ({ code, phoneNumber: phone }, ctx) =>
          phoneSender.sendOtp({ channel: otpChannelFrom(ctx), code, phone }),
        sendPasswordResetOTP: ({ code, phoneNumber: phone }, ctx) =>
          phoneSender.sendOtp({ channel: otpChannelFrom(ctx), code, phone }),
      }),
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

export type Auth = ReturnType<typeof createAuth>;

/** `{ session, user }` hasil `auth.api.getSession`. */
export type AuthSession = Auth["$Infer"]["Session"];
