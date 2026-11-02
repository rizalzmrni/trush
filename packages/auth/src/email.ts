import { EMAIL_VERIFICATION_OTP_TYPE } from "@trush/core/schemas/auth";
import {
  normalizeEmail,
  sendPasswordReset,
  sendVerificationOtp,
} from "@trush/email";
import type { EmailSender } from "@trush/email";
import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";

import { emailQuotaKey, OTP_RATE_RULES } from "./otp-rate-limit";
import type { OtpRateLimiter } from "./otp-rate-limit";
import type { BodyOverride, WaitUntil } from "./phone";

/** Umur OTP verifikasi email (detik), dipasang eksplisit di `emailOTP`. */
export const EMAIL_OTP_EXPIRES_SECONDS = 300;

/** Umur tautan reset password (detik), dipasang eksplisit di `emailAndPassword`. */
export const PASSWORD_RESET_EXPIRES_SECONDS = 3600;

const SECONDS_PER_MINUTE = 60;

/**
 * Endpoint `emailOTP` yang tidak dipakai trush, dimatikan lewat
 * `disabledPaths` (404 di router): login OTP email, reset password via OTP
 * (reset memakai tautan), ganti email, dan cek kode tanpa konsumsi (oracle
 * kode yang tidak dibutuhkan UI). Cocokkan dengan versi better-auth setiap
 * upgrade.
 */
export const DISABLED_EMAIL_OTP_PATHS = [
  // Endpoint inti better-auth; dengan `overrideDefaultEmailVerification` ia
  // mengirim OTP lewat plugin tanpa cek `type`, kuota publik, maupun captcha.
  "/send-verification-email",
  "/sign-in/email-otp",
  "/email-otp/check-verification-otp",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
];

const INVALID_OTP_TYPE = {
  code: "INVALID_OTP_TYPE",
  message: "Jenis kode tidak didukung.",
} as const;

export interface EmailDeliveryOptions {
  emailSender: EmailSender;
  /**
   * `executionCtx.waitUntil` api: email dikirim setelah respons, sehingga
   * respons dan waktunya sama untuk alamat terdaftar/tidak. Tanpa nilai
   * (test, CLI) pengiriman ditunggu, tetapi errornya tetap ditelan.
   */
  waitUntil?: WaitUntil | undefined;
  /** Kegagalan kirim di latar (log tanpa alamat/kode/tautan). */
  onDeliveryError?: ((error: unknown) => void) | undefined;
  /** Kuota email terkirim per alamat; tanpa nilai = tidak dibatasi. */
  otpRateLimiter?: OtpRateLimiter | undefined;
}

/** Jalankan `task` di latar (atau ditunggu bila tanpa `waitUntil`); error hanya ke log. */
export const runDetached = async (
  task: () => Promise<void>,
  { onDeliveryError, waitUntil }: EmailDeliveryOptions
): Promise<void> => {
  const run = async (): Promise<void> => {
    try {
      await task();
    } catch (error) {
      onDeliveryError?.(error);
    }
  };
  const delivery = run();
  if (waitUntil) {
    waitUntil(delivery);
    return;
  }
  await delivery;
};

/** `true` bila kuota kirim per alamat masih ada (429 = lewati, bukan error). */
const hasDeliveryQuota = async (
  limiter: OtpRateLimiter | undefined,
  email: string
): Promise<boolean> => {
  if (!limiter) {
    return true;
  }
  try {
    await limiter.consume([
      {
        key: emailQuotaKey("delivery", email),
        rule: OTP_RATE_RULES.emailDelivery,
      },
    ]);
    return true;
  } catch (error) {
    if (error instanceof APIError && error.statusCode === 429) {
      return false;
    }
    throw error;
  }
};

/**
 * `sendVerificationOTP` plugin `emailOTP`. Dipanggil plugin untuk alamat
 * terdaftar saja (daftar, login sebelum verifikasi lewat `sendOnSignIn`,
 * kirim ulang). Semua kerja berpotensi membedakan alamat (cek status
 * verifikasi, kuota kirim, render, Resend) terjadi di latar, jadi respons
 * dan waktunya sama untuk alamat terdaftar/tidak. Alamat yang sudah
 * terverifikasi dan alamat yang kuota kirimnya habis dilewati diam-diam.
 * Jenis selain `email-verification` sudah ditolak `emailBefore`.
 */
export const createSendVerificationOtp =
  (options: EmailDeliveryOptions) =>
  async (
    data: { email: string; otp: string; type: string },
    ctx?: GenericEndpointContext
  ): Promise<void> => {
    if (data.type !== EMAIL_VERIFICATION_OTP_TYPE) {
      return;
    }
    await runDetached(async () => {
      const found = ctx
        ? await ctx.context.internalAdapter.findUserByEmail(data.email)
        : null;
      if (found?.user.emailVerified === true) {
        return;
      }
      if (!(await hasDeliveryQuota(options.otpRateLimiter, data.email))) {
        return;
      }
      await sendVerificationOtp(options.emailSender, {
        code: data.otp,
        expiresInMinutes: EMAIL_OTP_EXPIRES_SECONDS / SECONDS_PER_MINUTE,
        to: data.email,
      });
    }, options);
  };

/**
 * `emailAndPassword.sendResetPassword`. better-auth memanggilnya hanya untuk
 * alamat terdaftar setelah kerja tiruan untuk alamat tak terdaftar;
 * pengiriman di latar (pola reset telepon B7b) agar respons identik.
 */
export const createSendResetPassword =
  (options: EmailDeliveryOptions) =>
  async (data: {
    user: { id: string; email: string };
    url: string;
    token: string;
  }): Promise<void> => {
    await runDetached(
      async () =>
        await sendPasswordReset(options.emailSender, {
          expiresInMinutes: PASSWORD_RESET_EXPIRES_SECONDS / SECONDS_PER_MINUTE,
          to: data.user.email,
          token: data.token,
          url: data.url,
          userId: data.user.id,
        }),
      options
    );
  };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export interface EmailBeforeHookOptions {
  emailSender: EmailSender;
  /** `CORS_ORIGINS`: satu-satunya origin tujuan tautan reset password. */
  allowedOrigins: readonly string[];
  /** Kuota permintaan per alamat; tanpa nilai = tidak dibatasi. */
  otpRateLimiter?: OtpRateLimiter | undefined;
}

const INVALID_REDIRECT_URL = {
  code: "INVALID_REDIRECT_URL",
  message: "Alamat tujuan tautan tidak diizinkan.",
} as const;

/** Origin URL absolut, atau `undefined` bila bukan URL absolut. */
const toOrigin = (value: string): string | undefined => {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

const readString = (source: unknown, key: string): string | undefined => {
  if (!isRecord(source)) {
    return undefined;
  }
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

/**
 * Tujuan redirect tautan reset (`redirectTo` saat meminta reset,
 * `callbackURL` saat tautan dibuka) wajib URL absolut http(s) ber-origin di
 * `CORS_ORIGINS`; kosong = tanpa redirect ke app (tetap di api). Selain itu
 * 403 `INVALID_REDIRECT_URL` SEBELUM token dibuat atau dibaca. Tanpa ini,
 * penyerang meminta reset untuk korban dengan `redirectTo` miliknya, korban
 * mengeklik tautan resmi, dan token terkirim ke origin penyerang (ambil alih
 * akun): `originCheck` better-auth tidak menahan request tanpa cookie.
 */
const assertTrustedRedirect = (
  target: string | undefined,
  origins: ReadonlySet<string | undefined>
): void => {
  if (target === undefined) {
    return;
  }
  const isHttp = target.startsWith("https://") || target.startsWith("http://");
  const origin = isHttp ? toOrigin(target) : undefined;
  if (origin === undefined || !origins.has(origin)) {
    throw APIError.from("FORBIDDEN", INVALID_REDIRECT_URL);
  }
};

type QuotaKind = "check" | "reset" | "verify";

const QUOTA_KIND_BY_PATH: Readonly<Record<string, QuotaKind>> = {
  "/email-otp/send-verification-otp": "verify",
  "/email-otp/verify-email": "check",
  "/request-password-reset": "reset",
};

const VERIFY_ATTEMPTS_LIMITED = {
  code: "OTP_RATE_LIMITED",
  message: "Terlalu banyak percobaan kode. Coba lagi nanti.",
} as const;

/**
 * Kuota per alamat untuk satu jenis permintaan. `check` (percobaan kode)
 * berlaku untuk semua alamat valid; jenis lain hanya untuk alamat yang
 * boleh dikirimi (`canSendTo`), karena alamat lain tidak pernah dikirimi.
 */
const consumeEmailQuota = async (
  limiter: OtpRateLimiter,
  kind: QuotaKind,
  email: string,
  emailSender: EmailSender
): Promise<void> => {
  if (kind === "check") {
    await limiter.consume([
      {
        error: VERIFY_ATTEMPTS_LIMITED,
        key: emailQuotaKey(kind, email),
        rule: OTP_RATE_RULES.emailCheck,
      },
    ]);
    return;
  }
  if (emailSender.canSendTo(email)) {
    await limiter.consume([
      { key: emailQuotaKey(kind, email), rule: OTP_RATE_RULES.emailRequest },
    ]);
  }
};

/**
 * Bagian email hook `before` (path-nya tidak beririsan dengan telepon):
 * 1. `/email-otp/send-verification-otp` hanya `type: "email-verification"`
 *    (400 `INVALID_OTP_TYPE` selainnya): OTP login/reset/ganti email tidak
 *    dipakai trush, dan tanpa ini plugin tetap mengirim OTP jenis lain ke
 *    alamat terdaftar.
 * 2. Tujuan tautan reset password (`redirectTo`, juga `callbackURL` saat
 *    tautan dibuka) hanya origin `CORS_ORIGINS` (`assertTrustedRedirect`).
 * 3. `/email-otp/verify-email`: kuota percobaan kode per alamat (B20),
 *    dihitung untuk SETIAP percobaan alamat valid, terdaftar atau tidak,
 *    sebelum kode diperiksa → 429 `OTP_RATE_LIMITED` identik. Sukses hanya
 *    sekali per kode, jadi praktis setara kuota kegagalan, tanpa tulis DB
 *    tambahan di jalur gagal (bukan oracle waktu).
 * 4. Kuota permintaan per alamat untuk kirim ulang kode dan lupa password,
 *    dihitung untuk SEMUA alamat yang valid dan boleh dikirimi (terdaftar
 *    atau tidak), setelah captcha + rate limit IP: 429 `OTP_RATE_LIMITED`
 *    tidak membocorkan keberadaan akun. Alamat ditolak `canSendTo` tidak
 *    dihitung (tidak akan pernah dikirimi).
 */
export const emailBefore =
  ({ allowedOrigins, emailSender, otpRateLimiter }: EmailBeforeHookOptions) =>
  async (ctx: GenericEndpointContext): Promise<BodyOverride> => {
    const origins = new Set(allowedOrigins.map(toOrigin));
    if (ctx.path.startsWith("/reset-password/")) {
      assertTrustedRedirect(readString(ctx.query, "callbackURL"), origins);
      return undefined;
    }
    const kind = QUOTA_KIND_BY_PATH[ctx.path];
    const { body } = ctx;
    if (kind === undefined || !isRecord(body)) {
      return undefined;
    }
    if (kind === "verify" && body.type !== EMAIL_VERIFICATION_OTP_TYPE) {
      throw APIError.from("BAD_REQUEST", INVALID_OTP_TYPE);
    }
    if (kind === "reset") {
      assertTrustedRedirect(readString(body, "redirectTo"), origins);
    }
    const email =
      typeof body.email === "string" ? normalizeEmail(body.email) : undefined;
    if (email === undefined) {
      return undefined;
    }
    if (otpRateLimiter) {
      await consumeEmailQuota(otpRateLimiter, kind, email, emailSender);
    }
    return { context: { body: { ...body, email } } };
  };

/** Sama dengan `BASE_ERROR_CODES.EMAIL_NOT_VERIFIED` better-auth. */
const EMAIL_NOT_VERIFIED = {
  code: "EMAIL_NOT_VERIFIED",
  message: "Email not verified",
} as const;

/** Identifier baris OTP verifikasi email plugin (`toOTPIdentifier`). */
const verificationOtpIdentifier = (email: string): string =>
  `${EMAIL_VERIFICATION_OTP_TYPE}-otp-${email}`;

const DECOY_BYTES = 32;
const MS_PER_SECOND = 1000;

/** Nilai acak base64url; tidak pernah sama dengan hash kode 6 digit mana pun. */
const randomDecoyValue = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(DECOY_BYTES));
  return btoa(String.fromCodePoint(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

/**
 * B21: plugin menghapus baris OTP untuk alamat tak terdaftar, sehingga
 * verify-email untuk alamat itu selalu `INVALID_OTP`, sedangkan alamat
 * terdaftar memberi `TOO_MANY_ATTEMPTS` pada tebakan ke-4 dan `OTP_EXPIRED`
 * setelah 5 menit (oracle keberadaan akun). Setelah kirim kode sukses untuk
 * alamat tak terdaftar, dibuat baris tiruan dengan identifier, bentuk nilai
 * (`<hash>:0`), dan umur yang sama; kodenya tidak pernah ada. verify-email
 * lalu menjalankan operasi DB yang sama dan menghasilkan urutan error yang
 * sama. Dikerjakan di latar (`waitUntil`) agar respons dan waktu kirim tetap
 * identik. Baris asli yang sudah ada tidak ditimpa.
 */
const createDecoyOtp = async (
  ctx: GenericEndpointContext,
  options: EmailDeliveryOptions
): Promise<void> => {
  const { body } = ctx;
  if (
    ctx.path !== "/email-otp/send-verification-otp" ||
    !isRecord(body) ||
    typeof body.email !== "string" ||
    body.type !== EMAIL_VERIFICATION_OTP_TYPE
  ) {
    return;
  }
  const returned = "returned" in ctx.context ? ctx.context.returned : null;
  if (returned instanceof APIError) {
    return;
  }
  const email = body.email.toLowerCase();
  await runDetached(async () => {
    const adapter = ctx.context.internalAdapter;
    if ((await adapter.findUserByEmail(email)) !== null) {
      return;
    }
    const identifier = verificationOtpIdentifier(email);
    if ((await adapter.findVerificationValue(identifier)) !== null) {
      return;
    }
    await adapter.createVerificationValue({
      expiresAt: new Date(
        Date.now() + EMAIL_OTP_EXPIRES_SECONDS * MS_PER_SECOND
      ),
      identifier,
      value: `${randomDecoyValue()}:0`,
    });
  }, options);
};

/**
 * Tidak ada sesi untuk email yang belum terverifikasi, apa pun jalurnya.
 * `/sign-in/email` dan `/sign-in/username` sudah menolak sendiri; penjaga
 * ini menutup jalur yang tidak memeriksa `emailVerified` (mis.
 * `/sign-in/phone-number`, lanjutan `/two-factor/*`). Berjalan sesudah
 * password diperiksa, jadi bukan oracle. Sesi baru dihapus dan cookie-nya
 * dibersihkan, lalu 403 `EMAIL_NOT_VERIFIED`. `/admin/*` (impersonasi)
 * dikecualikan.
 */
const revokeUnverifiedSession = async (
  ctx: GenericEndpointContext
): Promise<void> => {
  const created = ctx.context.newSession;
  if (
    created === null ||
    created.user.emailVerified ||
    ctx.path.startsWith("/admin/")
  ) {
    return;
  }
  await ctx.context.internalAdapter.deleteSession(created.session.token);
  deleteSessionCookie(ctx);
  throw APIError.from("FORBIDDEN", EMAIL_NOT_VERIFIED);
};

/** Bagian email hook `after`: baris OTP tiruan (B21) + penjaga sesi. */
export const emailAfter =
  (options: EmailDeliveryOptions) =>
  async (ctx: GenericEndpointContext): Promise<void> => {
    await createDecoyOtp(ctx, options);
    await revokeUnverifiedSession(ctx);
  };
