import { EMAIL_OTP_LENGTH, PHONE_OTP_LENGTH } from "@trush/core/schemas/auth";
import { newId } from "@trush/db";
import type { AnyDatabase } from "@trush/db";
import * as schema from "@trush/db/schema";
import { createEmailSender } from "@trush/email";
import type { EmailEnv, EmailLogger, EmailSender } from "@trush/email";
import type { ApiEnv } from "@trush/env/api";
import { createPhoneSender } from "@trush/phone";
import type { PhoneEnv, PhoneLogger, PhoneSender } from "@trush/phone";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import {
  admin,
  captcha,
  emailOTP,
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
  createSendResetPassword,
  createSendVerificationOtp,
  DISABLED_EMAIL_OTP_PATHS,
  EMAIL_OTP_EXPIRES_SECONDS,
  emailAfter,
  emailBefore,
  PASSWORD_RESET_EXPIRES_SECONDS,
} from "./email";
import { createOtpRateLimiter } from "./otp-rate-limit";
import type { OtpRateLimiter } from "./otp-rate-limit";
import {
  createSendOtp,
  createSendPasswordResetOtp,
  phoneAfter,
  phoneBefore,
} from "./phone";
import type { WaitUntil } from "./phone";
import { createPhoneVerifiedCallback } from "./phone-changed";
import { PHONE_OTP_EXPIRES_SECONDS } from "./phone-step-up";

/** Path handler better-auth di `apps/api`. */
export const AUTH_BASE_PATH = "/api/auth";

/**
 * Endpoint ber-captcha. Ditulis eksplisit karena opsi ini mengganti daftar
 * bawaan; cocokkan dengan versi better-auth setiap upgrade. Varian login lain (`/sign-in/username`, `/sign-in/phone-number`) dan
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
  "/email-otp/send-verification-otp",
];

const MINUTE_SECONDS = 60;

/**
 * Batas ketat per IP (`cf-connecting-ip`) untuk endpoint sensitif. Aturan
 * phone-number/email-otp sudah dipasang agar berlaku begitu plugin-nya aktif.
 */
const RATE_LIMIT_RULES = {
  "/sign-in/*": { max: 5, window: MINUTE_SECONDS },
  "/sign-up/*": { max: 3, window: MINUTE_SECONDS },
  // Butuh `currentPassword`: tanpa aturan ketat, pemegang sesi bisa memakainya
  // sebagai oracle brute-force password (aturan default global longgar).
  "/change-password": { max: 5, window: MINUTE_SECONDS },
  "/request-password-reset": { max: 3, window: MINUTE_SECONDS },
  "/two-factor/*": { max: 5, window: MINUTE_SECONDS },
  // WAJIB sebelum `/phone-number/*`: better-auth memakai aturan PERTAMA yang
  // cocok (urutan kunci objek). Verify lebih longgar agar salah ketik tidak
  // langsung 429; tebakan kode tetap dibatasi plugin (3x per OTP).
  "/phone-number/verify": { max: 10, window: MINUTE_SECONDS },
  "/phone-number/*": { max: 3, window: MINUTE_SECONDS },
  // WAJIB sebelum `/email-otp/*` (alasan sama dengan `/phone-number/verify`);
  // tebakan kode dibatasi plugin 3x per OTP.
  "/email-otp/verify-email": { max: 10, window: MINUTE_SECONDS },
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
  PhoneEnv &
  EmailEnv;

export interface CreateAuthOptions {
  /** Klien per request dari `createDb`; auth tidak membuka koneksi sendiri. */
  db: AnyDatabase;
  env: AuthEnv;
  /** Logger untuk driver `log` `@trush/phone` (development). */
  phoneLogger?: PhoneLogger | undefined;
  /** Pengganti pengirim OTP (test); default `createPhoneSender` dari env. */
  phoneSender?: PhoneSender | undefined;
  /**
   * `executionCtx.waitUntil` api: pengiriman OTP reset password berjalan
   * setelah respons (B7b). Tanpa nilai: ditunggu (test, CLI).
   */
  waitUntil?: WaitUntil | undefined;
  /** Error pengiriman OTP reset password di latar (untuk log, tanpa PII). */
  onPasswordResetOtpError?: ((error: unknown) => void) | undefined;
  /** Logger untuk driver `log` `@trush/email` (development). */
  emailLogger?: EmailLogger | undefined;
  /** Pengganti pengirim email (test); default `createEmailSender` dari env. */
  emailSender?: EmailSender | undefined;
  /**
   * Error pengiriman email di latar (kode verifikasi, tautan reset): untuk
   * log, tanpa alamat/kode/tautan. Semua email auth dikirim lewat
   * `waitUntil`, jadi error tidak pernah sampai ke pengguna.
   */
  onEmailDeliveryError?: ((error: unknown) => void) | undefined;
  /**
   * Kuota OTP per pengguna/nomor (B7c). Default: tabel `otp_rate_limit` di
   * `db`, aktif bila `APP_ENV` bukan development (sama dengan rate limit IP).
   */
  otpRateLimiter?: OtpRateLimiter | undefined;
}

/**
 * Instance better-auth per request (secret baru ada di binding Workers saat
 * request masuk). `auth.cli.ts` memanggil factory ini juga, jadi plugin untuk
 * CLI dan runtime selalu sama.
 */
export const createAuth = ({
  db,
  emailLogger,
  emailSender: emailSenderOverride,
  env,
  onEmailDeliveryError,
  onPasswordResetOtpError,
  otpRateLimiter = env.APP_ENV === "development"
    ? undefined
    : createOtpRateLimiter(db),
  phoneLogger,
  phoneSender = createPhoneSender({ env, logger: phoneLogger }),
  waitUntil,
}: CreateAuthOptions) => {
  const emailSender =
    emailSenderOverride ?? createEmailSender({ env, logger: emailLogger });
  const emailDelivery = {
    emailSender,
    onDeliveryError: onEmailDeliveryError,
    otpRateLimiter,
    waitUntil,
  };
  const phonePlugin = phoneNumber({
    // Eksplisit (bukan default better-auth) agar upgrade tidak melonggarkan:
    // 3 tebakan per OTP, panjang = kontrak form, umur = umur grant step-up.
    allowedAttempts: 3,
    // Setelah nomor ditambah/diganti: cabut sesi lain + notifikasi email (B16).
    callbackOnVerification: createPhoneVerifiedCallback(emailDelivery),
    expiresIn: PHONE_OTP_EXPIRES_SECONDS,
    otpLength: PHONE_OTP_LENGTH,
    // Ditolak (400 INVALID_PHONE_NUMBER) sebelum OTP dibuat: nomor tidak
    // valid, negara di luar PHONE_ALLOWED_COUNTRIES, atau di luar allowlist.
    phoneNumberValidator: (phone) => phoneSender.canSendTo(phone),
    // Sinkron: error Twilio → 4xx kode domain / 502 OTP_DELIVERY_FAILED.
    // Hanya untuk pengguna login (menambah nomor); login OTP mati.
    sendOTP: createSendOtp(phoneSender),
    // Di latar (waitUntil): respons nomor terdaftar/tidak identik (B7b).
    sendPasswordResetOTP: createSendPasswordResetOtp(phoneSender, {
      onDeliveryError: onPasswordResetOtpError,
      waitUntil,
    }),
  });
  const emailOtpPlugin = emailOTP({
    // Eksplisit (bukan default better-auth) agar upgrade tidak melonggarkan.
    allowedAttempts: 3,
    // Tidak ada pendaftaran lewat OTP; login OTP juga dimatikan
    // (`DISABLED_EMAIL_OTP_PATHS`).
    disableSignUp: true,
    expiresIn: EMAIL_OTP_EXPIRES_SECONDS,
    otpLength: EMAIL_OTP_LENGTH,
    // Verifikasi email bawaan (tautan) diganti kode OTP.
    overrideDefaultEmailVerification: true,
    sendVerificationOTP: createSendVerificationOtp(emailDelivery),
    // Kode di tabel `verification` hanya berupa hash.
    storeOTP: "hashed",
  });
  const emailHook = emailBefore({
    allowedOrigins: env.CORS_ORIGINS,
    emailSender,
    otpRateLimiter,
  });
  const phoneHook = phoneBefore({
    errors: phonePlugin.$ERROR_CODES,
    otpRateLimiter,
    phoneSender,
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
    // Endpoint `emailOTP` yang tidak dipakai → 404 di router.
    disabledPaths: DISABLED_EMAIL_OTP_PATHS,
    emailAndPassword: {
      enabled: true,
      // Login (email/username) ditolak 403 `EMAIL_NOT_VERIFIED` sesudah
      // password benar, sampai kode email diverifikasi.
      requireEmailVerification: true,
      // Reset lewat tautan; semua sesi pengguna dicabut setelah sukses.
      resetPasswordTokenExpiresIn: PASSWORD_RESET_EXPIRES_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: createSendResetPassword(emailDelivery),
    },
    emailVerification: {
      // Pengguna login sendiri setelah verifikasi (tanpa sesi otomatis).
      autoSignInAfterVerification: false,
      // Kode baru dikirim saat login dengan email belum terverifikasi.
      sendOnSignIn: true,
      sendOnSignUp: true,
      // `sendVerificationEmail` diisi plugin `emailOTP`
      // (`overrideDefaultEmailVerification`): kode OTP, bukan tautan.
    },
    // Nomor di body → E.164; login OTP dan phoneNumber di sign-up ditolak;
    // nomor tak terdaftar/belum terverifikasi tidak membocorkan keberadaannya.
    // Email: jenis OTP dibatasi, kuota per alamat (`emailBefore`).
    hooks: {
      // Sesi untuk email belum terverifikasi dicabut (semua jalur login);
      // grant step-up ganti nomor dihapus setelah verify sukses (B11).
      after: createAuthMiddleware(async (ctx) => {
        await emailAfter(ctx);
        await phoneAfter(ctx);
      }),
      before: createAuthMiddleware(
        async (ctx) => (await emailHook(ctx)) ?? (await phoneHook(ctx))
      ),
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
      emailOtpPlugin,
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
