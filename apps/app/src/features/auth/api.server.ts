import { CAPTCHA_HEADER, OTP_CHANNEL_HEADER } from "@trush/auth/client";
import type { PhoneOtpChannel } from "@trush/core/schemas/auth";

import { serverApiFetch } from "../../lib/api.server";
import type { RequestScope } from "../../lib/api.server";

/** Endpoint better-auth yang dipanggil action app lewat Service Binding. */
export const AUTH_ENDPOINTS = {
  phoneSendOtp: "/api/auth/phone-number/send-otp",
  phoneVerify: "/api/auth/phone-number/verify",
  signIn: "/api/auth/sign-in/email",
  signOut: "/api/auth/sign-out",
  signUp: "/api/auth/sign-up/email",
} as const;

type AuthEndpoint = (typeof AUTH_ENDPOINTS)[keyof typeof AUTH_ENDPOINTS];

interface AuthRequest {
  readonly body: Record<string, unknown>;
  /** Token Turnstile; wajib untuk endpoint ber-captcha. */
  readonly captchaToken?: string;
  readonly endpoint: AuthEndpoint;
  /**
   * Header tambahan yang diizinkan: hanya `x-otp-channel` (kirim OTP telepon).
   * Sengaja bukan `Record<string, string>`, agar pemanggil tidak bisa menimpa
   * `cookie`, `origin`, atau `cf-connecting-ip` yang diteruskan api-client.
   */
  readonly headers?: AuthExtraHeaders;
}

interface AuthExtraHeaders {
  readonly [OTP_CHANNEL_HEADER]?: PhoneOtpChannel;
}

/**
 * POST ke `/api/auth/*` lewat Service Binding. Header `cookie`, `origin`
 * (cek CSRF better-auth), `cf-connecting-ip`, dan `user-agent` diteruskan dari
 * request asli oleh factory api-client.
 */
export const postAuth = (
  scope: RequestScope,
  { body, captchaToken, endpoint, headers: extraHeaders }: AuthRequest
): Promise<Response> => {
  const headers = new Headers({ "content-type": "application/json" });
  // Disalin per nama (bukan spread) supaya objek berisi kunci lain tetap tidak
  // menambah header, meski lolos dari cek tipe.
  const otpChannel = extraHeaders?.[OTP_CHANNEL_HEADER];
  if (otpChannel) {
    headers.set(OTP_CHANNEL_HEADER, otpChannel);
  }
  if (captchaToken) {
    headers.set(CAPTCHA_HEADER, captchaToken);
  }
  return serverApiFetch(scope)(endpoint, {
    body: JSON.stringify(body),
    headers,
    method: "POST",
  });
};

/**
 * `Set-Cookie` dari response api untuk diteruskan ke response app, agar
 * cookie sesi sampai ke browser (login lewat action, bukan fetch langsung).
 */
export const forwardSetCookies = (
  response: Response,
  headers: Headers = new Headers()
): Headers => {
  for (const cookie of response.headers.getSetCookie()) {
    headers.append("set-cookie", cookie);
  }
  return headers;
};

const HTTP_TOO_MANY_REQUESTS = 429;

export const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_EMAIL_OR_PASSWORD: "Email atau kata sandi salah.",
  MISSING_RESPONSE: "Selesaikan verifikasi keamanan terlebih dahulu.",
  PASSWORD_COMPROMISED:
    "Kata sandi ini pernah bocor di layanan lain. Pilih kata sandi yang berbeda.",
  PASSWORD_TOO_LONG: "Kata sandi terlalu panjang.",
  PASSWORD_TOO_SHORT: "Kata sandi terlalu pendek.",
  SERVICE_UNAVAILABLE:
    "Layanan verifikasi keamanan sedang bermasalah. Coba lagi sebentar.",
  USER_ALREADY_EXISTS: "Email ini sudah terdaftar. Silakan masuk.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Email ini sudah terdaftar. Silakan masuk.",
  VERIFICATION_FAILED: "Verifikasi keamanan gagal. Coba lagi.",
};

export const FALLBACK_MESSAGE =
  "Terjadi kesalahan. Coba lagi beberapa saat lagi.";
const RATE_LIMIT_MESSAGE =
  "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";

export const readCode = async (
  response: Response
): Promise<string | undefined> => {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "code" in body) {
      return typeof body.code === "string" ? body.code : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

/** Pesan Indonesia untuk response gagal better-auth (tanpa detail internal). */
export const authErrorMessage = async (response: Response): Promise<string> => {
  if (response.status === HTTP_TOO_MANY_REQUESTS) {
    return RATE_LIMIT_MESSAGE;
  }
  const code = await readCode(response);
  return (code ? AUTH_ERROR_MESSAGES[code] : undefined) ?? FALLBACK_MESSAGE;
};

/** Response sukses sign-in yang meminta verifikasi 2FA (belum ada halamannya). */
export const needsTwoFactor = async (response: Response): Promise<boolean> => {
  try {
    const body: unknown = await response.clone().json();
    return (
      typeof body === "object" &&
      body !== null &&
      "twoFactorRedirect" in body &&
      body.twoFactorRedirect === true
    );
  } catch {
    return false;
  }
};
