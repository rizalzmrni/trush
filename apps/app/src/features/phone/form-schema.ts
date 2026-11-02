import {
  PASSWORD_MAX_LENGTH,
  PHONE_OTP_LENGTH,
  sendPhoneOtpInputSchema,
  verifyPhoneOtpInputSchema,
} from "@trush/core/schemas/auth";
import type { PhoneOtpChannel } from "@trush/core/schemas/auth";
import { z } from "zod";

import type { FieldErrors, IssueLike } from "../auth/form-schema";

/**
 * Halaman pengaturan nomor. GET ulang ke path ini mengosongkan hasil action
 * (tombol "Ganti nomor").
 */
export const PHONE_SETTINGS_PATH = "/settings/phone";

/** Field tersembunyi yang memilih langkah action `/settings/phone`. */
export const INTENT_FIELD = "intent";

export const PHONE_INTENTS = {
  /** Kirim kode ulang dari langkah verifikasi (biasanya lewat SMS). */
  resend: "resend-otp",
  send: "send-otp",
  verify: "verify-otp",
} as const;

export type PhoneIntent = (typeof PHONE_INTENTS)[keyof typeof PHONE_INTENTS];

export const isPhoneIntent = (value: unknown): value is PhoneIntent =>
  Object.values<unknown>(PHONE_INTENTS).includes(value);

/** Label kanal untuk teks UI. */
export const CHANNEL_LABELS: Readonly<Record<PhoneOtpChannel, string>> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
};

// Kontrak input dari `@trush/core`; form hanya menambah token Turnstile
// (dikirim lewat header `x-captcha-response`, kanal lewat `x-otp-channel`).
export const sendOtpFormSchema = sendPhoneOtpInputSchema.extend({
  captchaToken: z.string().min(1),
});

export const verifyOtpFormSchema = verifyPhoneOtpInputSchema;

export type SendOtpForm = z.infer<typeof sendOtpFormSchema>;
export type VerifyOtpForm = z.infer<typeof verifyOtpFormSchema>;

/** Pesan Indonesia per field form telepon (skema kontrak tanpa pesan). */
export const phoneFieldMessage = ({ code, path }: IssueLike): string => {
  const [field] = path ?? [];
  switch (field) {
    case "captchaToken": {
      return "Selesaikan verifikasi keamanan terlebih dahulu.";
    }
    case "channel": {
      return "Pilih cara pengiriman kode.";
    }
    case "code": {
      return `Masukkan ${PHONE_OTP_LENGTH} digit kode yang kamu terima.`;
    }
    case "currentPassword": {
      return code === "too_big"
        ? `Kata sandi maksimal ${PASSWORD_MAX_LENGTH} karakter.`
        : "Masukkan kata sandi saat ini.";
    }
    case "phoneNumber": {
      return "Masukkan nomor telepon yang valid, mis. 0812-3456-7890.";
    }
    default: {
      return "Isian tidak valid.";
    }
  }
};

/** Langkah 1: isi nomor. Gagal → tetap di langkah ini. */
export interface SendStepResult {
  readonly step: "send";
  readonly fieldErrors?: FieldErrors<SendOtpForm>;
  readonly formError?: string;
  /** Nilai yang diisi ulang; kata sandi tidak pernah ikut. */
  readonly values: {
    readonly channel?: PhoneOtpChannel;
    readonly phoneNumber?: string;
  };
}

/** Langkah 2: kode terkirim, masukkan kode (atau kirim ulang). */
export interface VerifyStepResult {
  readonly step: "verify";
  readonly channel: PhoneOtpChannel;
  /** `currentPassword`: field kata sandi di form kirim ulang (ganti nomor). */
  readonly fieldErrors?: FieldErrors<
    VerifyOtpForm & Pick<SendOtpForm, "currentPassword">
  >;
  readonly formError?: string;
  /** Info kode terkirim (status, bukan error). */
  readonly notice?: string;
  readonly phoneNumber: string;
}

/** Nomor terverifikasi; loader dimuat ulang sehingga status ikut berubah. */
export interface DoneStepResult {
  readonly step: "done";
}

export type PhoneActionResult =
  | DoneStepResult
  | SendStepResult
  | VerifyStepResult;
