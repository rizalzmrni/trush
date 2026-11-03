import { EMAIL_AUTH_ERROR_CODES } from "@trush/core/schemas/auth";

import { AUTH_ERROR_MESSAGES, FALLBACK_MESSAGE, readCode } from "./api.server";
import { rateLimitMessage } from "./retry-after.server";

const HTTP_TOO_MANY_REQUESTS = 429;

/** Pesan per kode error alur email (`EMAIL_AUTH_ERROR_CODES` + better-auth). */
const EMAIL_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [EMAIL_AUTH_ERROR_CODES.emailNotVerified]:
    "Email belum diverifikasi. Masukkan kode yang kami kirim ke emailmu.",
  [EMAIL_AUTH_ERROR_CODES.invalidOtp]:
    "Kode salah. Periksa lagi lalu coba kembali.",
  [EMAIL_AUTH_ERROR_CODES.invalidToken]:
    "Tautan reset kata sandi tidak berlaku atau sudah kedaluwarsa. Minta tautan baru.",
  [EMAIL_AUTH_ERROR_CODES.otpExpired]:
    "Kode sudah kedaluwarsa. Minta kode baru di bawah.",
  [EMAIL_AUTH_ERROR_CODES.tooManyAttempts]:
    "Terlalu banyak kode salah. Minta kode baru di bawah.",
};

export interface EmailAuthError {
  /** Kode error api (`{ code }`), bila ada. */
  readonly code?: string;
  readonly message: string;
}

/**
 * Kode + pesan Indonesia untuk response gagal alur email (verifikasi kode,
 * kirim ulang kode, lupa/reset kata sandi). `rateLimitSubject` adalah kalimat
 * pembuka pesan 429; waktu tunggu dibaca dari `Retry-After`/`X-Retry-After`.
 * Body dibaca sekali.
 */
export const emailAuthError = async (
  response: Response,
  rateLimitSubject: string,
  now: Date = new Date()
): Promise<EmailAuthError> => {
  const code = await readCode(response);
  if (response.status === HTTP_TOO_MANY_REQUESTS) {
    return { code, message: rateLimitMessage(response, rateLimitSubject, now) };
  }
  if (code === undefined) {
    return { message: FALLBACK_MESSAGE };
  }
  return {
    code,
    message:
      EMAIL_ERROR_MESSAGES[code] ??
      AUTH_ERROR_MESSAGES[code] ??
      FALLBACK_MESSAGE,
  };
};
