import { PHONE_STEP_UP_ERROR_CODES } from "@trush/core/schemas/auth";
import type { GenericEndpointContext } from "better-auth";
import { APIError, getSessionFromCtx } from "better-auth/api";

import { OTP_RATE_RULES, stepUpUserKey } from "./otp-rate-limit";
import type { OtpRateLimiter } from "./otp-rate-limit";

/**
 * Umur OTP telepon (detik), dipasang eksplisit di plugin `phoneNumber`
 * (`expiresIn`) dan dipakai sebagai umur grant step-up.
 */
export const PHONE_OTP_EXPIRES_SECONDS = 300;

const MS_PER_SECOND = 1000;

/** Field body `send-otp` berisi password saat ini (kontrak `@trush/core`). */
export const CURRENT_PASSWORD_FIELD = "currentPassword";

const PASSWORD_REQUIRED = {
  code: PHONE_STEP_UP_ERROR_CODES.passwordRequired,
  message:
    "Masukkan password saat ini untuk menambah atau mengganti nomor telepon.",
} as const;

const INVALID_PASSWORD = {
  code: PHONE_STEP_UP_ERROR_CODES.invalidPassword,
  message: "Password saat ini salah.",
} as const;

const PASSWORD_ATTEMPTS_LIMITED = {
  code: PHONE_STEP_UP_ERROR_CODES.passwordAttemptsLimited,
  message: "Terlalu banyak percobaan password. Coba lagi nanti.",
} as const;

/** Satu grant aktif per pengguna (identifier tabel `verification`). */
const grantIdentifier = (userId: string): string => `phone-step-up:${userId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Password lewat `ctx.context.password.checkPassword` better-auth: akun credential,
 * batas panjang, dan hash tiruan saat akun tanpa password (waktu setara).
 * Semua penolakannya (salah, terlalu panjang, tanpa credential) → `false`.
 */
const isCurrentPassword = async (
  ctx: GenericEndpointContext,
  userId: string,
  password: string
): Promise<boolean> => {
  try {
    return await ctx.context.password.checkPassword(userId, {
      ...ctx,
      body: { password },
    });
  } catch (error) {
    if (error instanceof APIError) {
      return false;
    }
    throw error;
  }
};

/** `currentPassword` dari body; string kosong sama dengan tidak ada. */
const readCurrentPassword = (body: unknown): string | undefined => {
  if (!isRecord(body)) {
    return undefined;
  }
  const value = body[CURRENT_PASSWORD_FIELD];
  return typeof value === "string" && value !== "" ? value : undefined;
};

interface SendOtpStepUpOptions {
  /** Nomor E.164 hasil normalisasi; `undefined` bila tidak valid. */
  phoneNumber: string | undefined;
  /** Kuota percobaan per pengguna; tanpa nilai (development) tidak dibatasi. */
  limiter?: OtpRateLimiter | undefined;
}

/**
 * B11, SETIAP `/phone-number/send-otp` dengan sesi (tambah nomor pertama,
 * ganti nomor, kirim ulang): pemegang sesi saja tidak cukup untuk memasang
 * nomor, karena nomor membuka reset password lewat telepon.
 * 1. tanpa `currentPassword` → 403 `PASSWORD_REQUIRED`;
 * 2. kuota percobaan step-up per pengguna (benar atau salah) → 429
 *    `PASSWORD_ATTEMPTS_LIMITED`, sehingga brute-force dari banyak IP tetap
 *    dibatasi selain rate limit IP + Turnstile;
 * 3. password salah / akun tanpa password → 400 `INVALID_PASSWORD`;
 * 4. benar → grant (pengguna, nomor) menggantikan grant lama, umur sama
 *    dengan OTP. `verify` mewajibkan grant ini.
 * Semua penolakan terjadi sebelum OTP dibuat/dikirim dan sebelum kuota OTP
 * terpakai. Tanpa sesi tidak diperiksa: OTP memang tidak dikirim.
 */
export const authorizeSendOtp = async (
  ctx: GenericEndpointContext,
  { limiter, phoneNumber }: SendOtpStepUpOptions
): Promise<void> => {
  const session = await getSessionFromCtx(ctx);
  if (session === null) {
    return;
  }
  const userId = session.user.id;
  const password = readCurrentPassword(ctx.body);
  if (password === undefined) {
    throw APIError.from("FORBIDDEN", PASSWORD_REQUIRED);
  }
  await limiter?.consume([
    {
      error: PASSWORD_ATTEMPTS_LIMITED,
      key: stepUpUserKey(userId),
      rule: OTP_RATE_RULES.stepUp,
    },
  ]);
  if (!(await isCurrentPassword(ctx, userId, password))) {
    throw APIError.from("BAD_REQUEST", INVALID_PASSWORD);
  }
  if (phoneNumber === undefined) {
    // Nomor tidak valid: validator plugin menolak 400, tidak ada OTP.
    return;
  }
  const identifier = grantIdentifier(userId);
  await ctx.context.internalAdapter.deleteVerificationByIdentifier(identifier);
  await ctx.context.internalAdapter.createVerificationValue({
    expiresAt: new Date(Date.now() + PHONE_OTP_EXPIRES_SECONDS * MS_PER_SECOND),
    identifier,
    value: phoneNumber,
  });
};

/**
 * B11, `/phone-number/verify` (`updatePhoneNumber`, sesi sudah dipastikan):
 * selalu wajib grant aktif untuk pengguna dan nomor yang sama, selain itu 403 `PASSWORD_REQUIRED` SEBELUM kode diperiksa, jadi
 * tidak memakan percobaan kode. Grant tidak dikonsumsi di sini (kode salah
 * tidak memaksa ketik ulang password); lihat `consumeStepUpGrant`.
 */
export const assertVerifyStepUp = async (
  ctx: GenericEndpointContext,
  userId: string,
  phoneNumber: string
): Promise<void> => {
  const grant = await ctx.context.internalAdapter.findVerificationValue(
    grantIdentifier(userId)
  );
  const isValid =
    grant !== null &&
    grant.value === phoneNumber &&
    grant.expiresAt.getTime() > Date.now();
  if (!isValid) {
    throw APIError.from("FORBIDDEN", PASSWORD_REQUIRED);
  }
};

/**
 * Hook `after`: grant sekali pakai, dihapus begitu verify sukses.
 * `returned` = `ctx.context.returned` (body sukses atau `APIError`).
 */
export const consumeStepUpGrant = async (
  ctx: GenericEndpointContext,
  returned: unknown
): Promise<void> => {
  const succeeded = isRecord(returned) && returned.status === true;
  if (!succeeded) {
    return;
  }
  const session = await getSessionFromCtx(ctx);
  if (session === null) {
    return;
  }
  await ctx.context.internalAdapter.deleteVerificationByIdentifier(
    grantIdentifier(session.user.id)
  );
};

/** Body tanpa `currentPassword`: password tidak pernah sampai ke plugin. */
export const withoutCurrentPassword = (
  body: Record<string, unknown>
): Record<string, unknown> => {
  const { [CURRENT_PASSWORD_FIELD]: _omitted, ...rest } = body;
  return rest;
};
