import {
  EMAIL_OTP_LENGTH,
  emailInputSchema,
  sendEmailVerificationOtpInputSchema,
  verifyEmailOtpInputSchema,
} from "@trush/core/schemas/auth";
import { z } from "zod";

import { fieldMessage } from "../auth/form-schema";
import type { FieldErrors, IssueLike } from "../auth/form-schema";

/** Field tersembunyi yang memilih langkah action `/verify-email`. */
export const INTENT_FIELD = "intent";

export const VERIFY_EMAIL_INTENTS = {
  /** Kirim ulang kode dari langkah kode; butuh Turnstile. */
  resend: "resend-code",
  /** Kirim kode dari langkah isi email; butuh Turnstile. */
  send: "send-code",
  verify: "verify-code",
} as const;

export type VerifyEmailIntent =
  (typeof VERIFY_EMAIL_INTENTS)[keyof typeof VERIFY_EMAIL_INTENTS];

export const isVerifyEmailIntent = (
  value: unknown
): value is VerifyEmailIntent =>
  Object.values<unknown>(VERIFY_EMAIL_INTENTS).includes(value);

/** Query string halaman verifikasi. */
export const EMAIL_PARAM = "email";
export const REASON_PARAM = "reason";

/** Asal pengguna ke halaman verifikasi; menentukan pesan pembuka. */
export const VERIFY_REASONS = {
  /** Login ditolak `EMAIL_NOT_VERIFIED`; server sudah mengirim kode baru. */
  signIn: "sign-in",
  /** Baru daftar; kode dikirim saat sign-up. */
  signUp: "sign-up",
} as const;

export type VerifyReason = (typeof VERIFY_REASONS)[keyof typeof VERIFY_REASONS];

const REASON_NOTICES: Readonly<Record<VerifyReason, string>> = {
  [VERIFY_REASONS.signIn]:
    "Email ini belum diverifikasi. Kami sudah mengirim kode baru ke emailmu.",
  [VERIFY_REASONS.signUp]:
    "Akun berhasil dibuat. Kami sudah mengirim kode verifikasi ke emailmu.",
};

/** Pesan pembuka dari `?reason=`; hanya nilai yang dikenal. */
export const reasonNotice = (value: string | null): string | undefined =>
  Object.hasOwn(REASON_NOTICES, value ?? "")
    ? REASON_NOTICES[value as VerifyReason]
    : undefined;

/** Email dari `?email=`, dinormalisasi seperti server; tidak valid → `undefined`. */
export const emailFromQuery = (value: string | null): string | undefined => {
  const parsed = emailInputSchema.safeParse(value ?? "");
  return parsed.success ? parsed.data : undefined;
};

// Kontrak input dari `@trush/core`; form kirim kode menambah token Turnstile
// (dikirim lewat header `x-captcha-response`, bukan body).
export const sendCodeFormSchema = sendEmailVerificationOtpInputSchema.extend({
  captchaToken: z.string().min(1),
});

export const verifyCodeFormSchema = verifyEmailOtpInputSchema;

export type SendCodeForm = z.infer<typeof sendCodeFormSchema>;
export type VerifyCodeForm = z.infer<typeof verifyCodeFormSchema>;

/** Pesan Indonesia per field form verifikasi email. */
export const verifyEmailFieldMessage = (issue: IssueLike): string => {
  const [field] = issue.path ?? [];
  if (field === "otp") {
    return `Masukkan ${EMAIL_OTP_LENGTH} digit kode dari email.`;
  }
  return fieldMessage(issue);
};

/** Email belum diketahui: isi email lalu minta kode. */
export interface RequestStepResult {
  readonly step: "request";
  readonly fieldErrors?: FieldErrors<SendCodeForm>;
  readonly formError?: string;
  readonly values: { readonly email?: string };
}

/** Email diketahui: masukkan kode (atau kirim ulang). */
export interface VerifyStepResult {
  readonly step: "verify";
  readonly email: string;
  readonly fieldErrors?: FieldErrors<SendCodeForm & VerifyCodeForm>;
  readonly formError?: string;
  /** Info kode terkirim (status, bukan error). */
  readonly notice?: string;
}

export type VerifyEmailActionResult = RequestStepResult | VerifyStepResult;
