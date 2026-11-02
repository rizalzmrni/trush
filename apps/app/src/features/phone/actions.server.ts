import { OTP_CHANNEL_HEADER } from "@trush/auth/client";
import { PHONE_STEP_UP_ERROR_CODES } from "@trush/core/schemas/auth";
import type { PhoneOtpChannel } from "@trush/core/schemas/auth";
import { data } from "react-router";

import type { RequestScope } from "../../lib/api.server";
import {
  AUTH_ENDPOINTS,
  forwardSetCookies,
  postAuth,
} from "../auth/api.server";
import { parseAuthForm } from "../auth/form-schema";
import { phoneError } from "./errors.server";
import {
  CHANNEL_LABELS,
  INTENT_FIELD,
  isPhoneIntent,
  PHONE_INTENTS,
  phoneFieldMessage,
  sendOtpFormSchema,
  verifyOtpFormSchema,
} from "./form-schema";
import type {
  PhoneActionResult,
  SendStepResult,
  VerifyStepResult,
} from "./form-schema";

const HTTP_BAD_REQUEST = 400;

const formText = (formData: FormData, name: string): string | undefined => {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
};

const asChannel = (value: string | undefined): PhoneOtpChannel =>
  value === "sms" ? "sms" : "whatsapp";

const reply = (result: PhoneActionResult, init?: ResponseInit) =>
  data(result, init ?? { status: HTTP_BAD_REQUEST });

/** Error api yang ditampilkan di field kata sandi, bukan di atas form. */
const PASSWORD_FIELD_CODES: ReadonlySet<string | undefined> = new Set([
  PHONE_STEP_UP_ERROR_CODES.invalidPassword,
  PHONE_STEP_UP_ERROR_CODES.passwordRequired,
]);

/** Verify tanpa grant step-up (kedaluwarsa/nomor lain) → minta kode ulang. */
const GRANT_MISSING_MESSAGE =
  "Waktu verifikasi sudah habis. Minta kode lagi dengan kata sandi saat ini.";

const sentNotice = (channel: PhoneOtpChannel, phoneNumber: string): string =>
  `Kode dikirim lewat ${CHANNEL_LABELS[channel]} ke ${phoneNumber}.`;

/**
 * Kirim OTP ke nomor baru (pengguna login). Kanal lewat `x-otp-channel`,
 * token Turnstile lewat `x-captcha-response`. Dipakai langkah isi nomor
 * maupun "kirim ulang" di langkah verifikasi. `currentPassword` selalu ikut
 * di body (step-up B11, juga untuk nomor pertama); nilainya tidak pernah
 * dikembalikan ke halaman.
 */
const sendOtp = async (
  scope: RequestScope,
  formData: FormData,
  failStep: "send" | "verify"
) => {
  const rawPhone = formText(formData, "phoneNumber")?.trim();
  const rawChannel = asChannel(formText(formData, "channel"));
  const failure = (
    fields: Pick<SendStepResult, "fieldErrors" | "formError">,
    status?: number
  ) => {
    const init = status ? { status } : undefined;
    if (failStep === "verify" && rawPhone) {
      const { currentPassword, ...otherErrors } = fields.fieldErrors ?? {};
      const result: VerifyStepResult = {
        channel: rawChannel,
        formError: fields.formError ?? Object.values(otherErrors)[0],
        phoneNumber: rawPhone,
        step: "verify",
        ...(currentPassword ? { fieldErrors: { currentPassword } } : {}),
      };
      return reply(result, init);
    }
    const result: SendStepResult = {
      ...fields,
      step: "send",
      values: { channel: rawChannel, phoneNumber: rawPhone },
    };
    return reply(result, init);
  };

  const parsed = parseAuthForm(sendOtpFormSchema, formData, phoneFieldMessage);
  if (!parsed.success) {
    return failure({ fieldErrors: parsed.fieldErrors });
  }
  const { captchaToken, channel, currentPassword, phoneNumber } = parsed.data;
  const response = await postAuth(scope, {
    // String kosong = tidak ada; server membalas 403 PASSWORD_REQUIRED.
    body: currentPassword ? { currentPassword, phoneNumber } : { phoneNumber },
    captchaToken,
    endpoint: AUTH_ENDPOINTS.phoneSendOtp,
    headers: { [OTP_CHANNEL_HEADER]: channel },
  });
  if (!response.ok) {
    const error = await phoneError(response, "send");
    return failure(
      PASSWORD_FIELD_CODES.has(error.code)
        ? { fieldErrors: { currentPassword: error.message } }
        : { formError: error.message },
      response.status
    );
  }
  const result: VerifyStepResult = {
    channel,
    notice: sentNotice(channel, phoneNumber),
    phoneNumber,
    step: "verify",
  };
  return data(result);
};

/** Verifikasi kode; `updatePhoneNumber: true` menyimpan nomor ke akun. */
const verifyOtp = async (scope: RequestScope, formData: FormData) => {
  const phoneNumber = formText(formData, "phoneNumber")?.trim() ?? "";
  const channel = asChannel(formText(formData, "channel"));
  const parsed = parseAuthForm(
    verifyOtpFormSchema,
    formData,
    phoneFieldMessage
  );
  if (!parsed.success) {
    // Nomor hilang/rusak → kembali ke langkah isi nomor.
    if (parsed.fieldErrors.phoneNumber) {
      return reply({
        fieldErrors: { phoneNumber: parsed.fieldErrors.phoneNumber },
        step: "send",
        values: { channel, phoneNumber },
      });
    }
    return reply({
      channel,
      fieldErrors: parsed.fieldErrors,
      phoneNumber,
      step: "verify",
    });
  }
  const response = await postAuth(scope, {
    body: {
      code: parsed.data.code,
      phoneNumber: parsed.data.phoneNumber,
      updatePhoneNumber: true,
    },
    endpoint: AUTH_ENDPOINTS.phoneVerify,
  });
  if (!response.ok) {
    const error = await phoneError(response, "verify");
    if (error.code === PHONE_STEP_UP_ERROR_CODES.passwordRequired) {
      return reply(
        {
          formError: GRANT_MISSING_MESSAGE,
          step: "send",
          values: { channel, phoneNumber },
        },
        { status: response.status }
      );
    }
    return reply(
      { channel, formError: error.message, phoneNumber, step: "verify" },
      { status: response.status }
    );
  }
  return data({ step: "done" } satisfies PhoneActionResult, {
    headers: forwardSetCookies(response),
  });
};

/** `POST /settings/phone`: kirim, kirim ulang, atau verifikasi OTP. */
export const phoneAction = async (scope: RequestScope) => {
  const formData = await scope.request.formData();
  const intent = formData.get(INTENT_FIELD);
  if (!isPhoneIntent(intent)) {
    return reply({
      formError: "Permintaan tidak dikenal. Muat ulang halaman.",
      step: "send",
      values: {},
    });
  }
  switch (intent) {
    case PHONE_INTENTS.send: {
      return sendOtp(scope, formData, "send");
    }
    case PHONE_INTENTS.resend: {
      return sendOtp(scope, formData, "verify");
    }
    default: {
      return verifyOtp(scope, formData);
    }
  }
};
