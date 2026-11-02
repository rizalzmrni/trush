import { z } from "zod";

/**
 * Batas panjang password = default better-auth (`emailAndPassword`
 * `minPasswordLength`/`maxPasswordLength`); ubah bersamaan bila `createAuth`
 * menyetelnya.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 100;

/** Input form login email (`/api/auth/sign-in/email`). */
export const signInEmailInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/** Input form daftar email (`/api/auth/sign-up/email`). */
export const signUpEmailInputSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  email: z.email(),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

/** Panjang OTP telepon; dipasang eksplisit sebagai `otpLength` plugin `phoneNumber` (`@trush/auth`). */
export const PHONE_OTP_LENGTH = 6;

/**
 * Format dasar nomor yang diketik pengguna: lokal (`0812-3456-7890`) atau
 * E.164 (`+6281234567890`), boleh spasi/tanda hubung/kurung. Validasi negara,
 * allowlist, dan normalisasi E.164 tetap di server (`@trush/phone`).
 */
const PHONE_INPUT = /^\+?\d[\d\s()-]{6,18}\d$/u;
const OTP_CODE = new RegExp(`^\\d{${PHONE_OTP_LENGTH}}$`, "u");

/**
 * Kanal OTP telepon. Dikirim lewat header `x-otp-channel` (bukan body);
 * nilai selain `sms` berarti WhatsApp.
 */
export const phoneOtpChannelSchema = z.enum(["whatsapp", "sms"]);

export const phoneNumberInputSchema = z.string().trim().regex(PHONE_INPUT);

/**
 * Password saat ini untuk step-up nomor telepon (B11). Wajib di server untuk
 * setiap `send-otp` dengan sesi (tambah maupun ganti nomor); tetap
 * `.optional()` di skema agar tidak breaking. String kosong diperlakukan
 * server sama dengan tidak ada.
 */
export const currentPasswordInputSchema = z.string().max(PASSWORD_MAX_LENGTH);

/**
 * Input form kirim OTP (`/api/auth/phone-number/send-otp`, body JSON).
 * `currentPassword` wajib (server) untuk setiap kirim, termasuk tambah nomor
 * pertama dan kirim ulang. Password benar memberi "grant"
 * step-up terikat (pengguna, nomor) yang dipakai `verify`, jadi password
 * tidak dikirim lagi di langkah verifikasi.
 */
export const sendPhoneOtpInputSchema = z.object({
  phoneNumber: phoneNumberInputSchema,
  channel: phoneOtpChannelSchema.default("whatsapp"),
  currentPassword: currentPasswordInputSchema.optional(),
});

/**
 * Kode error step-up ganti nomor (body `{ code, message }`):
 * - `PASSWORD_REQUIRED` (403): `send-otp` tanpa `currentPassword`, atau
 *   `verify` tanpa grant yang cocok (kirim ulang kode dengan password).
 * - `INVALID_PASSWORD` (400): password salah (juga akun tanpa password).
 * - `PASSWORD_ATTEMPTS_LIMITED` (429 + `Retry-After`): kuota percobaan
 *   step-up per pengguna habis (10/jam, password benar ikut dihitung).
 */
export const PHONE_STEP_UP_ERROR_CODES = {
  invalidPassword: "INVALID_PASSWORD",
  passwordAttemptsLimited: "PASSWORD_ATTEMPTS_LIMITED",
  passwordRequired: "PASSWORD_REQUIRED",
} as const;

export type PhoneStepUpErrorCode =
  (typeof PHONE_STEP_UP_ERROR_CODES)[keyof typeof PHONE_STEP_UP_ERROR_CODES];

/**
 * Input form verifikasi OTP (`/api/auth/phone-number/verify`, dikirim dengan
 * `updatePhoneNumber: true`). `phoneNumber` sama dengan saat kirim OTP.
 */
export const verifyPhoneOtpInputSchema = z.object({
  phoneNumber: phoneNumberInputSchema,
  code: z.string().trim().regex(OTP_CODE),
});

/** Panjang OTP verifikasi email; dipasang eksplisit sebagai `otpLength` plugin `emailOTP` (`@trush/auth`). */
export const EMAIL_OTP_LENGTH = 6;

const EMAIL_OTP_CODE = new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`, "u");

/**
 * Satu-satunya `type` OTP email yang dilayani server. Login OTP email, reset
 * password lewat OTP, dan ganti email lewat OTP ditolak `@trush/auth` (404).
 */
export const EMAIL_VERIFICATION_OTP_TYPE = "email-verification";

/** Alamat email form; dipangkas dan dijadikan huruf kecil seperti server. */
export const emailInputSchema = z.string().trim().toLowerCase().pipe(z.email());

/**
 * Input form verifikasi kode email (`/api/auth/email-otp/verify-email`,
 * body JSON `{ email, otp }`). Setelah sukses pengguna login ulang (sesi
 * tidak dibuat otomatis).
 */
export const verifyEmailOtpInputSchema = z.object({
  email: emailInputSchema,
  otp: z.string().trim().regex(EMAIL_OTP_CODE),
});

/**
 * Input "kirim ulang kode" (`/api/auth/email-otp/send-verification-otp`,
 * body JSON `{ email, type }`, header Turnstile `x-captcha-response`).
 * Respons 200 identik untuk email terdaftar/tidak/sudah terverifikasi.
 * Kuota per alamat → 429 `OTP_RATE_LIMITED` + `Retry-After`.
 */
export const sendEmailVerificationOtpInputSchema = z.object({
  email: emailInputSchema,
  type: z
    .literal(EMAIL_VERIFICATION_OTP_TYPE)
    .default(EMAIL_VERIFICATION_OTP_TYPE),
});

/**
 * Input form lupa password (`/api/auth/request-password-reset`, body JSON
 * `{ email, redirectTo }`, header Turnstile). `redirectTo` diisi klien:
 * URL absolut halaman `/reset-password` app (harus termasuk `CORS_ORIGINS`).
 * Tautan di email membuka api lalu dialihkan ke `redirectTo?token=...`, atau
 * `redirectTo?error=INVALID_TOKEN` bila token tidak sah/kedaluwarsa. Respons
 * 200 identik untuk email terdaftar/tidak.
 */
export const forgotPasswordInputSchema = z.object({
  email: emailInputSchema,
});

/**
 * Input form reset password (`/api/auth/reset-password`, body JSON
 * `{ newPassword, token }`). Aturan password sama dengan daftar. Sukses →
 * semua sesi pengguna dicabut; token salah/kedaluwarsa/terpakai → 400
 * `INVALID_TOKEN`.
 */
export const resetPasswordInputSchema = z.object({
  token: z.string().trim().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

/**
 * Kode error alur email (body `{ code, message }`):
 * - `EMAIL_NOT_VERIFIED` (403): login email/username sebelum verifikasi;
 *   server sekaligus mengirim kode baru, arahkan ke halaman verifikasi.
 * - `INVALID_OTP` (400), `OTP_EXPIRED` (400), `TOO_MANY_ATTEMPTS` (403,
 *   kode dihapus, minta kode baru): verifikasi kode email.
 * - `OTP_RATE_LIMITED` (429 + `Retry-After`): kuota kirim kode per alamat.
 * - `INVALID_TOKEN` (400): reset password dengan token tidak sah.
 */
export const EMAIL_AUTH_ERROR_CODES = {
  emailNotVerified: "EMAIL_NOT_VERIFIED",
  invalidOtp: "INVALID_OTP",
  invalidToken: "INVALID_TOKEN",
  otpExpired: "OTP_EXPIRED",
  otpRateLimited: "OTP_RATE_LIMITED",
  tooManyAttempts: "TOO_MANY_ATTEMPTS",
} as const;

export type EmailAuthErrorCode =
  (typeof EMAIL_AUTH_ERROR_CODES)[keyof typeof EMAIL_AUTH_ERROR_CODES];

export type SignInEmailInput = z.infer<typeof signInEmailInputSchema>;
export type SignUpEmailInput = z.infer<typeof signUpEmailInputSchema>;
export type PhoneOtpChannel = z.infer<typeof phoneOtpChannelSchema>;
export type SendPhoneOtpInput = z.infer<typeof sendPhoneOtpInputSchema>;
export type VerifyPhoneOtpInput = z.infer<typeof verifyPhoneOtpInputSchema>;
export type VerifyEmailOtpInput = z.infer<typeof verifyEmailOtpInputSchema>;
export type SendEmailVerificationOtpInput = z.infer<
  typeof sendEmailVerificationOtpInputSchema
>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
