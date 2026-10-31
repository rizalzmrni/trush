import type { OtpChannel, PhoneSender } from "@trush/phone";
import { createAuthMiddleware } from "better-auth/api";

/** Header pilihan kanal OTP: `sms` untuk "kirim ulang via SMS", default WhatsApp. */
export const OTP_CHANNEL_HEADER = "x-otp-channel";

/** Kanal dari header request; nilai selain `sms` berarti WhatsApp. */
export const otpChannelFrom = (
  ctx: { headers?: Headers | undefined } | undefined
): OtpChannel =>
  ctx?.headers?.get(OTP_CHANNEL_HEADER) === "sms" ? "sms" : "whatsapp";

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
 * Hook `before`: `phoneNumber` di body diganti bentuk E.164 sebelum endpoint
 * berjalan, sehingga OTP, kolom `user.phone_number`, dan pencarian login
 * memakai satu bentuk. Nomor yang tidak bisa dinormalisasi dibiarkan; validator
 * plugin lalu menolaknya.
 */
export const normalizePhoneBody = (phoneSender: PhoneSender) =>
  createAuthMiddleware((ctx): Promise<BodyOverride> => {
    const { body } = ctx;
    const e164 = hasPhoneNumber(body)
      ? phoneSender.normalize(body.phoneNumber)
      : undefined;
    if (
      !hasPhoneNumber(body) ||
      e164 === undefined ||
      e164 === body.phoneNumber
    ) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve({
      context: { body: { ...body, phoneNumber: e164 } },
    });
  });
