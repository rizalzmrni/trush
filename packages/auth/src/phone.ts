import { PhoneError } from "@trush/phone";
import type { OtpChannel, PhoneErrorCode, PhoneSender } from "@trush/phone";
import type { GenericEndpointContext } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";

import { OTP_RATE_RULES, otpPhoneKey, otpUserKey } from "./otp-rate-limit";
import type { OtpRateLimiter } from "./otp-rate-limit";

/** Header pilihan kanal OTP: `sms` untuk "kirim ulang via SMS", default WhatsApp. */
export const OTP_CHANNEL_HEADER = "x-otp-channel";

/** Kode error `{ code, message }` seperti `$ERROR_CODES` plugin better-auth. */
interface ErrorCode {
  code: string;
  message: string;
}

/**
 * Kode error plugin `phoneNumber` yang dipakai ulang hook, diambil dari
 * `$ERROR_CODES` instance plugin agar body error identik dengan bawaannya.
 */
export interface PhoneErrorCodes {
  INVALID_OTP: ErrorCode;
  INVALID_PHONE_NUMBER_OR_PASSWORD: ErrorCode;
}

/** Sama dengan `BASE_ERROR_CODES.USER_NOT_FOUND` (verify tanpa sesi). */
const NO_SESSION_ERROR: ErrorCode = {
  code: "USER_NOT_FOUND",
  message: "User not found",
};

/** Sama dengan error `input: false` better-auth (`FIELD_NOT_ALLOWED`). */
const PHONE_FIELD_NOT_ALLOWED: ErrorCode = {
  code: "FIELD_NOT_ALLOWED",
  message: "phoneNumber is not allowed to be set",
};

/** Error domain yang terlihat pengguna saat kirim OTP gagal di penyedia. */
type ApiErrorStatus = Parameters<typeof APIError.from>[0];

const STATUS_BY_PHONE_ERROR: Readonly<Record<PhoneErrorCode, ApiErrorStatus>> =
  {
    INVALID_NUMBER: "BAD_REQUEST",
    NOT_ALLOWLISTED: "BAD_REQUEST",
    PROVIDER_CONFIG: "BAD_GATEWAY",
    PROVIDER_ERROR: "BAD_GATEWAY",
    RATE_LIMITED: "TOO_MANY_REQUESTS",
    RECIPIENT_UNREACHABLE: "UNPROCESSABLE_ENTITY",
    UNSUPPORTED_DESTINATION: "BAD_REQUEST",
  };

/** Pesan pengguna per kode; detail penyedia tidak pernah dikirim ke klien. */
const MESSAGE_BY_PHONE_ERROR: Readonly<Record<PhoneErrorCode, string>> = {
  INVALID_NUMBER: "Nomor telepon tidak valid.",
  NOT_ALLOWLISTED: "Nomor telepon tidak diizinkan di lingkungan ini.",
  PROVIDER_CONFIG: "Kode OTP gagal dikirim. Coba lagi nanti.",
  PROVIDER_ERROR: "Kode OTP gagal dikirim. Coba lagi nanti.",
  RATE_LIMITED: "Terlalu banyak permintaan kode. Coba lagi nanti.",
  RECIPIENT_UNREACHABLE: "Nomor tidak dapat dihubungi lewat kanal ini.",
  UNSUPPORTED_DESTINATION: "Negara nomor telepon tidak didukung.",
};

/** Kode publik untuk 5xx: kegagalan penyedia/konfigurasi tidak dibedakan. */
const DELIVERY_FAILED_CODE = "OTP_DELIVERY_FAILED";

/** `PhoneError` → `APIError` (4xx dengan kode domain, atau 502 generik). */
export const toAuthError = (error: PhoneError): APIError => {
  const status = STATUS_BY_PHONE_ERROR[error.code];
  const isServerSide =
    error.code === "PROVIDER_CONFIG" || error.code === "PROVIDER_ERROR";
  return APIError.from(status, {
    code: isServerSide ? DELIVERY_FAILED_CODE : error.code,
    message: MESSAGE_BY_PHONE_ERROR[error.code],
  });
};

/** Kanal dari header request; nilai selain `sms` berarti WhatsApp. */
export const otpChannelFrom = (
  ctx: { headers?: Headers | undefined } | undefined
): OtpChannel =>
  ctx?.headers?.get(OTP_CHANNEL_HEADER) === "sms" ? "sms" : "whatsapp";

/** Kirim OTP sinkron; `PhoneError` → `APIError` 4xx/502. */
const deliverOtp = async (
  phoneSender: PhoneSender,
  { code, phoneNumber }: { code: string; phoneNumber: string },
  ctx: GenericEndpointContext | undefined
): Promise<void> => {
  try {
    await phoneSender.sendOtp({
      channel: otpChannelFrom(ctx),
      code,
      phone: phoneNumber,
    });
  } catch (error) {
    throw error instanceof PhoneError ? toAuthError(error) : error;
  }
};

/**
 * `sendOTP` plugin `phoneNumber`, SINKRON (tanpa waitUntil): error penyedia
 * menjadi respons 4xx/502. Login OTP mati (telepon hanya tambahan akun),
 * jadi OTP hanya dikirim ke pengguna yang login untuk menambah nomornya.
 * Tanpa sesi tidak pernah ada pengiriman, sedangkan responsnya tetap sama
 * ("code sent"): keberadaan nomor tidak bocor (status maupun waktu) dan
 * endpoint tidak bisa dipakai SMS pumping tanpa akun.
 */
export const createSendOtp =
  (phoneSender: PhoneSender) =>
  async (
    data: { code: string; phoneNumber: string },
    ctx?: GenericEndpointContext
  ): Promise<void> => {
    const session = ctx ? await getSessionFromCtx(ctx) : null;
    if (session === null) {
      return;
    }
    await deliverOtp(phoneSender, data, ctx);
  };

/** Penjadwal kerja setelah respons (`ctx.waitUntil` Worker). */
export type WaitUntil = (promise: Promise<unknown>) => void;

export interface PasswordResetOtpOptions {
  /**
   * `executionCtx.waitUntil` dari api. Tanpa nilai (test, CLI) pengiriman
   * ditunggu, tetapi errornya tetap ditelan agar respons sama.
   */
  waitUntil?: WaitUntil | undefined;
  /** Dipanggil saat pengiriman di latar gagal (log tanpa nomor/kode). */
  onDeliveryError?: ((error: unknown) => void) | undefined;
}

/**
 * `sendPasswordResetOTP` (B7b): plugin hanya memanggilnya untuk nomor
 * terdaftar, setelah kerja yang sama untuk semua nomor (cari user, simpan
 * OTP). Pengiriman dipindah ke `waitUntil` sehingga respons nomor terdaftar
 * dan tidak terdaftar sama persis (200 `{ status: true }`) dan waktunya
 * setara: panggilan penyedia tidak lagi ada di jalur respons.
 *
 * Trade-off dengan `sendOTP` (sinkron): error penyedia untuk reset password
 * TIDAK sampai ke pengguna (hanya ke log lewat `onDeliveryError`), karena
 * error yang hanya muncul untuk nomor terdaftar adalah oracle keberadaan
 * akun. Pengguna yang tidak menerima kode cukup meminta ulang / via SMS.
 */
export const createSendPasswordResetOtp =
  (
    phoneSender: PhoneSender,
    { onDeliveryError, waitUntil }: PasswordResetOtpOptions = {}
  ) =>
  async (
    data: { code: string; phoneNumber: string },
    ctx?: GenericEndpointContext
  ): Promise<void> => {
    const channel = otpChannelFrom(ctx);
    // `PhoneError` mentah (kodenya untuk log), bukan `APIError` seperti sendOTP.
    const deliver = async (): Promise<void> => {
      try {
        await phoneSender.sendOtp({
          channel,
          code: data.code,
          phone: data.phoneNumber,
        });
      } catch (error) {
        onDeliveryError?.(error);
      }
    };
    const delivery = deliver();
    if (waitUntil) {
      waitUntil(delivery);
      return;
    }
    await delivery;
  };

const isRecord = (body: unknown): body is Record<string, unknown> =>
  typeof body === "object" && body !== null;

const hasPhoneNumber = (
  body: unknown
): body is Record<string, unknown> & { phoneNumber: string } =>
  isRecord(body) && typeof body.phoneNumber === "string";

/** Nomor hanya sah untuk login bila terverifikasi lewat OTP. */
const hasVerifiedPhone = async (
  ctx: GenericEndpointContext,
  phoneNumber: string
): Promise<boolean> => {
  const user = await ctx.context.adapter.findOne<{ id: string }>({
    model: "user",
    where: [
      { field: "phoneNumber", value: phoneNumber },
      { field: "phoneNumberVerified", value: true },
    ],
  });
  return user !== null;
};

/** Hasil hook `before`: `context` digabung ke context endpoint. */
type BodyOverride = { context: { body: Record<string, unknown> } } | undefined;

interface PhoneBeforeHookOptions {
  errors: PhoneErrorCodes;
  phoneSender: PhoneSender;
  /** Batas OTP per pengguna/nomor (B7c); tanpa nilai = tidak dibatasi. */
  otpRateLimiter?: OtpRateLimiter | undefined;
}

/**
 * B7c: kuota OTP per nomor tujuan (dan per pengguna untuk `send-otp`),
 * dihitung setelah captcha + rate limit IP (`onRequest`) dan sebelum OTP
 * dibuat. `request-password-reset` dihitung untuk SEMUA nomor yang valid,
 * terdaftar atau tidak, jadi 429 tidak membocorkan keberadaan akun.
 * `send-otp` tanpa sesi tidak dihitung (tidak pernah mengirim), agar orang
 * lain tidak bisa menghabiskan kuota nomor korban tanpa akun.
 * Nomor yang gagal normalisasi atau `canSendTo` (negara/allowlist) tidak
 * dihitung sama sekali: `phoneNumberValidator` menolaknya 400 tanpa OTP,
 * sama untuk nomor terdaftar maupun tidak, jadi tetap tanpa oracle (B7d).
 */
const consumeOtpQuota = async (
  ctx: GenericEndpointContext,
  phoneNumber: string | undefined,
  limiter: OtpRateLimiter,
  phoneSender: PhoneSender
): Promise<void> => {
  if (phoneNumber === undefined || !phoneSender.canSendTo(phoneNumber)) {
    return;
  }
  const phoneQuota = [
    { key: otpPhoneKey(phoneNumber), rule: OTP_RATE_RULES.phone },
  ];
  if (ctx.path === "/phone-number/request-password-reset") {
    await limiter.consume(phoneQuota);
    return;
  }
  if (ctx.path !== "/phone-number/send-otp") {
    return;
  }
  const session = await getSessionFromCtx(ctx);
  if (session === null) {
    return;
  }
  await limiter.consume([
    { key: otpUserKey(session.user.id), rule: OTP_RATE_RULES.user },
    ...phoneQuota,
  ]);
};

/**
 * `/phone-number/verify` hanya untuk menambah nomor ke akun yang login.
 * Tanpa `updatePhoneNumber: true` (jalur login OTP bawaan plugin, termasuk
 * `disableSession`) ditolak 400 `INVALID_OTP` SEBELUM kode diperiksa, jadi
 * tidak ada sesi, tidak melewati 2FA, dan bukan oracle kode benar/salah.
 * Tanpa sesi ditolak 401 sebelum kode dikonsumsi.
 */
const assertVerifyAddsPhone = async (
  ctx: GenericEndpointContext,
  body: unknown,
  errors: PhoneErrorCodes
): Promise<void> => {
  if (!isRecord(body) || body.updatePhoneNumber !== true) {
    throw APIError.from("BAD_REQUEST", errors.INVALID_OTP);
  }
  if ((await getSessionFromCtx(ctx)) === null) {
    throw APIError.from("UNAUTHORIZED", NO_SESSION_ERROR);
  }
};

/**
 * Hook `before` (aturan lengkap di `packages/auth/CLAUDE.md`):
 * 1. `/sign-up/*` dengan `phoneNumber` ditolak 400, apa pun nomornya (tanpa
 *    oracle nomor terpakai). Nomor hanya masuk lewat verify + sesi.
 * 2. `/phone-number/verify` lihat `assertVerifyAddsPhone`.
 * 3. `phoneNumber` diganti E.164, jadi OTP, kolom `user.phone_number`, dan
 *    pencarian login memakai satu bentuk.
 * 4. Kuota OTP per pengguna/nomor, lihat `consumeOtpQuota`.
 * 5. `/sign-in/phone-number` untuk nomor tak terdaftar atau belum
 *    terverifikasi: password tetap di-hash (waktu setara) lalu 401 yang sama
 *    persis dengan password salah.
 */
export const phoneBeforeHook = ({
  errors,
  otpRateLimiter,
  phoneSender,
}: PhoneBeforeHookOptions) =>
  createAuthMiddleware(async (ctx): Promise<BodyOverride> => {
    const { body } = ctx;
    if (ctx.path.startsWith("/sign-up/")) {
      const claimsPhone =
        isRecord(body) &&
        body.phoneNumber !== undefined &&
        body.phoneNumber !== null;
      if (claimsPhone) {
        throw APIError.from("BAD_REQUEST", PHONE_FIELD_NOT_ALLOWED);
      }
      return undefined;
    }
    if (ctx.path === "/phone-number/verify") {
      await assertVerifyAddsPhone(ctx, body, errors);
    }
    if (!hasPhoneNumber(body)) {
      return undefined;
    }
    const normalized = phoneSender.normalize(body.phoneNumber);
    const phoneNumber = normalized ?? body.phoneNumber;
    if (otpRateLimiter) {
      await consumeOtpQuota(ctx, normalized, otpRateLimiter, phoneSender);
    }
    if (
      ctx.path === "/sign-in/phone-number" &&
      !(await hasVerifiedPhone(ctx, phoneNumber))
    ) {
      await ctx.context.password.hash(String(body.password ?? ""));
      throw APIError.from(
        "UNAUTHORIZED",
        errors.INVALID_PHONE_NUMBER_OR_PASSWORD
      );
    }
    return { context: { body: { ...body, phoneNumber } } };
  });
