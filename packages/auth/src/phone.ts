import { PhoneError } from "@trush/phone";
import type { OtpChannel, PhoneErrorCode, PhoneSender } from "@trush/phone";
import type { GenericEndpointContext } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";

/** Header pilihan kanal OTP: `sms` untuk "kirim ulang via SMS", default WhatsApp. */
export const OTP_CHANNEL_HEADER = "x-otp-channel";

/**
 * Pengganti kode OTP untuk nomor tak terdaftar di `/phone-number/verify`.
 * Tidak mungkin sama dengan OTP numerik, jadi plugin menempuh jalur "kode
 * salah" biasa (hitungan percobaan, TOO_MANY_ATTEMPTS, OTP_NOT_FOUND identik).
 */
const UNMATCHABLE_OTP = "-";

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

const findUserIdByPhone = async (
  ctx: GenericEndpointContext,
  phoneNumber: string
): Promise<string | undefined> => {
  const user = await ctx.context.adapter.findOne<{ id: string }>({
    model: "user",
    where: [{ field: "phoneNumber", value: phoneNumber }],
  });
  return user?.id;
};

/**
 * `sendOTP` plugin `phoneNumber`, SINKRON (tanpa waitUntil): error penyedia
 * menjadi respons 4xx/502. Telepon hanya tambahan akun, jadi OTP hanya
 * dikirim ke pengguna yang login (menambah nomor) atau ke nomor terdaftar
 * (login). Nomor lain tidak dikirimi, tetapi responsnya tetap sama ("code
 * sent") agar keberadaan nomor tidak bocor dan tidak bisa dipakai SMS pumping.
 */
export const createSendOtp =
  (phoneSender: PhoneSender) =>
  async (
    { code, phoneNumber }: { code: string; phoneNumber: string },
    ctx?: GenericEndpointContext
  ): Promise<void> => {
    if (ctx) {
      const session = await getSessionFromCtx(ctx);
      const isRegistered =
        session !== null ||
        (await findUserIdByPhone(ctx, phoneNumber)) !== undefined;
      if (!isRegistered) {
        return;
      }
    }
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

const hasPhoneNumber = (
  body: unknown
): body is Record<string, unknown> & { phoneNumber: string } =>
  typeof body === "object" &&
  body !== null &&
  "phoneNumber" in body &&
  typeof body.phoneNumber === "string";

/** Hasil hook `before`: `context` digabung ke context endpoint. */
type BodyOverride = { context: { body: Record<string, unknown> } } | undefined;

/**
 * Hook `before` untuk body ber-`phoneNumber`:
 * 1. `phoneNumber` diganti E.164, jadi OTP, kolom `user.phone_number`, dan
 *    pencarian login memakai satu bentuk.
 * 2. `/sign-in/phone-number` dengan nomor tak terdaftar tetap meng-hash
 *    password (plugin langsung melempar 401), agar waktu respons tidak
 *    membedakan nomor terdaftar dan tidak.
 * 3. `/phone-number/verify` tanpa `updatePhoneNumber` untuk nomor tak
 *    terdaftar: telepon bukan jalur daftar, dan plugin akan melempar 500
 *    `FAILED_TO_UPDATE_USER` untuk kode yang benar. Kodenya diganti agar
 *    hasilnya 400 `INVALID_OTP`, sama persis dengan kode salah.
 */
export const phoneBeforeHook = (phoneSender: PhoneSender) =>
  createAuthMiddleware(async (ctx): Promise<BodyOverride> => {
    const { body } = ctx;
    if (!hasPhoneNumber(body)) {
      return undefined;
    }
    const phoneNumber =
      phoneSender.normalize(body.phoneNumber) ?? body.phoneNumber;
    const override: Record<string, unknown> = { phoneNumber };
    const needsRegisteredUser =
      ctx.path === "/sign-in/phone-number" ||
      (ctx.path === "/phone-number/verify" && body.updatePhoneNumber !== true);
    const isRegistered =
      !needsRegisteredUser ||
      (await findUserIdByPhone(ctx, phoneNumber)) !== undefined;
    if (!isRegistered && ctx.path === "/sign-in/phone-number") {
      await ctx.context.password.hash(String(body.password ?? ""));
    }
    if (!isRegistered && ctx.path === "/phone-number/verify") {
      override.code = UNMATCHABLE_OTP;
    }
    return { context: { body: { ...body, ...override } } };
  });
