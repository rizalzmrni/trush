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

export type SignInEmailInput = z.infer<typeof signInEmailInputSchema>;
export type SignUpEmailInput = z.infer<typeof signUpEmailInputSchema>;
export type PhoneOtpChannel = z.infer<typeof phoneOtpChannelSchema>;
export type SendPhoneOtpInput = z.infer<typeof sendPhoneOtpInputSchema>;
export type VerifyPhoneOtpInput = z.infer<typeof verifyPhoneOtpInputSchema>;
