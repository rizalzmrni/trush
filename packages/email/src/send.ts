import { render } from "@react-email/render";
import { createElement } from "react";
import type { ReactElement } from "react";

import type { EmailSender } from "./sender";
import {
  PasswordResetEmail,
  passwordResetSubject,
} from "./templates/password-reset";
import type { PasswordResetEmailProps } from "./templates/password-reset";
import {
  PhoneNumberChangedEmail,
  phoneNumberChangedSubject,
} from "./templates/phone-number-changed";
import type { PhoneNumberChangedEmailProps } from "./templates/phone-number-changed";
import {
  VerificationOtpEmail,
  verificationOtpSubject,
} from "./templates/verification-otp";
import type { VerificationOtpEmailProps } from "./templates/verification-otp";

const HEX_RADIX = 16;
const HEX_PAD = 2;
/** 128 bit cukup untuk membedakan kunci; idempotency key Resend maks 256 karakter. */
const DIGEST_HEX_LENGTH = 32;

/**
 * SHA-256 heksadesimal (dipotong). Rahasia (kode OTP, token reset) dan
 * alamat tidak pernah masuk kunci idempotensi apa adanya.
 */
export const digest = async (value: string): Promise<string> => {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );
  return [...bytes]
    .map((byte) => byte.toString(HEX_RADIX).padStart(HEX_PAD, "0"))
    .join("")
    .slice(0, DIGEST_HEX_LENGTH);
};

interface RenderedEmail {
  html: string;
  text: string;
}

const renderEmail = async (element: ReactElement): Promise<RenderedEmail> => {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { html, text };
};

export interface SendVerificationOtpInput extends VerificationOtpEmailProps {
  to: string;
}

/**
 * Kode verifikasi email. Kunci: `verification-otp/<hash(alamat, kode)>`,
 * jadi kirim ulang kode yang sama tidak menggandakan email, kode baru tetap
 * terkirim.
 */
export const sendVerificationOtp = async (
  sender: EmailSender,
  { code, expiresInMinutes, to }: SendVerificationOtpInput
): Promise<void> => {
  const rendered = await renderEmail(
    createElement(VerificationOtpEmail, { code, expiresInMinutes })
  );
  await sender.send({
    ...rendered,
    code,
    idempotencyKey: `verification-otp/${await digest(`${to.trim().toLowerCase()}:${code}`)}`,
    subject: verificationOtpSubject(),
    template: "verification-otp",
    to,
  });
};

export interface SendPasswordResetInput extends PasswordResetEmailProps {
  to: string;
  userId: string;
  /** Token reset better-auth; hanya hash-nya yang masuk kunci idempotensi. */
  token: string;
}

/** Tautan reset password. Kunci: `password-reset/<userId>/<hash(token)>`. */
export const sendPasswordReset = async (
  sender: EmailSender,
  { expiresInMinutes, to, token, url, userId }: SendPasswordResetInput
): Promise<void> => {
  const rendered = await renderEmail(
    createElement(PasswordResetEmail, { expiresInMinutes, url })
  );
  await sender.send({
    ...rendered,
    code: null,
    idempotencyKey: `password-reset/${userId}/${await digest(token)}`,
    subject: passwordResetSubject(),
    template: "password-reset",
    to,
  });
};

export interface SendPhoneNumberChangedInput {
  to: string;
  userId: string;
  maskedPhoneNumber: PhoneNumberChangedEmailProps["maskedPhoneNumber"];
  /** Waktu perubahan; diformat WIB di email. */
  changedAt: Date;
}

const WIB_FORMAT = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

/** `2 November 2026 pukul 14.05 WIB`. */
export const formatChangedAt = (date: Date): string =>
  `${WIB_FORMAT.format(date)} WIB`;

/**
 * Notifikasi nomor telepon diubah. Kunci:
 * `phone-number-changed/<userId>/<waktu ms>`.
 */
export const sendPhoneNumberChanged = async (
  sender: EmailSender,
  { changedAt, maskedPhoneNumber, to, userId }: SendPhoneNumberChangedInput
): Promise<void> => {
  const rendered = await renderEmail(
    createElement(PhoneNumberChangedEmail, {
      changedAt: formatChangedAt(changedAt),
      maskedPhoneNumber,
    })
  );
  await sender.send({
    ...rendered,
    code: null,
    idempotencyKey: `phone-number-changed/${userId}/${changedAt.getTime()}`,
    subject: phoneNumberChangedSubject(),
    template: "phone-number-changed",
    to,
  });
};
