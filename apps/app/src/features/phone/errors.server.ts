import { PHONE_STEP_UP_ERROR_CODES } from "@trush/core/schemas/auth";
import { formatRelativeTime } from "@trush/design-system/lib/format";

import {
  AUTH_ERROR_MESSAGES,
  FALLBACK_MESSAGE,
  readCode,
} from "../auth/api.server";

const HTTP_TOO_MANY_REQUESTS = 429;
const MS_PER_SECOND = 1000;

/**
 * Pesan per kode error telepon (`@trush/auth` phone + plugin `phoneNumber`
 * better-auth). Kegagalan penyedia hanya muncul sebagai `OTP_DELIVERY_FAILED`
 * dan tidak pernah dijelaskan lebih rinci ke pengguna.
 */
const PHONE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_NUMBER: "Nomor telepon tidak valid.",
  INVALID_OTP: "Kode salah. Periksa lagi lalu coba kembali.",
  [PHONE_STEP_UP_ERROR_CODES.invalidPassword]: "Kata sandi saat ini salah.",
  INVALID_PHONE_NUMBER:
    "Nomor telepon tidak valid atau negaranya belum didukung.",
  NOT_ALLOWLISTED: "Nomor ini tidak dapat dipakai di lingkungan ini.",
  OTP_DELIVERY_FAILED: "Kode gagal dikirim. Coba lagi beberapa saat lagi.",
  OTP_EXPIRED: "Kode sudah kedaluwarsa. Minta kode baru.",
  OTP_NOT_FOUND: "Kode tidak ditemukan. Minta kode baru.",
  [PHONE_STEP_UP_ERROR_CODES.passwordRequired]:
    "Masukkan kata sandi saat ini untuk menambah atau mengganti nomor.",
  PHONE_NUMBER_EXIST: "Nomor ini sudah dipakai akun lain.",
  RECIPIENT_UNREACHABLE:
    "Kode tidak dapat dikirim ke nomor ini lewat cara yang dipilih. Coba cara lain.",
  TOO_MANY_ATTEMPTS: "Terlalu banyak kode salah. Minta kode baru.",
  UNSUPPORTED_DESTINATION: "Negara nomor telepon ini belum didukung.",
  USER_NOT_FOUND:
    "Sesi kamu sudah berakhir. Muat ulang halaman lalu masuk lagi.",
};

/**
 * Detik tunggu dari `Retry-After` (kuota OTP `OTP_RATE_LIMITED`) atau
 * `X-Retry-After` (rate limit IP better-auth). Hanya bentuk detik.
 */
export const retryAfterSeconds = (response: Response): number | undefined => {
  const raw =
    response.headers.get("retry-after") ??
    response.headers.get("x-retry-after");
  if (raw === null || !/^\d+$/u.test(raw.trim())) {
    return undefined;
  }
  const seconds = Number(raw.trim());
  return seconds > 0 ? seconds : undefined;
};

/**
 * Langkah yang gagal: `send` (kirim/kirim ulang OTP, kuota permintaan) atau
 * `verify` (cek kode, rate limit IP `/phone-number/verify`).
 */
export type PhoneErrorKind = "send" | "verify";

const RATE_LIMIT_SUBJECT: Readonly<Record<PhoneErrorKind, string>> = {
  send: "Terlalu banyak permintaan kode.",
  verify: "Terlalu banyak percobaan kode.",
};

/** Kuota step-up per pengguna (`PASSWORD_ATTEMPTS_LIMITED`), lintas langkah. */
const PASSWORD_LIMIT_SUBJECT = "Terlalu banyak percobaan kata sandi.";

/** Mis. "Terlalu banyak permintaan kode. Coba lagi dalam 12 menit." */
const rateLimitMessage = (
  response: Response,
  subject: string,
  now: Date
): string => {
  const seconds = retryAfterSeconds(response);
  if (seconds === undefined) {
    return `${subject} Tunggu sebentar lalu coba lagi.`;
  }
  const retryAt = new Date(now.getTime() + seconds * MS_PER_SECOND);
  return `${subject} Coba lagi ${formatRelativeTime(retryAt, { now })}.`;
};

export interface PhoneError {
  /** Kode error api (`{ code }`), bila ada. */
  readonly code?: string;
  readonly message: string;
}

/**
 * Kode + pesan Indonesia untuk response gagal kirim/verifikasi OTP telepon.
 * `kind` hanya memengaruhi teks 429 rate limit kode. Body dibaca sekali.
 */
export const phoneError = async (
  response: Response,
  kind: PhoneErrorKind = "send",
  now: Date = new Date()
): Promise<PhoneError> => {
  const code = await readCode(response);
  if (response.status === HTTP_TOO_MANY_REQUESTS) {
    const subject =
      code === PHONE_STEP_UP_ERROR_CODES.passwordAttemptsLimited
        ? PASSWORD_LIMIT_SUBJECT
        : RATE_LIMIT_SUBJECT[kind];
    return { code, message: rateLimitMessage(response, subject, now) };
  }
  if (code === undefined) {
    return { message: FALLBACK_MESSAGE };
  }
  return {
    code,
    message:
      PHONE_ERROR_MESSAGES[code] ??
      AUTH_ERROR_MESSAGES[code] ??
      FALLBACK_MESSAGE,
  };
};

/** Pesan Indonesia saja; lihat `phoneError`. */
export const phoneErrorMessage = async (
  response: Response,
  kind: PhoneErrorKind = "send",
  now: Date = new Date()
): Promise<string> => {
  const { message } = await phoneError(response, kind, now);
  return message;
};
