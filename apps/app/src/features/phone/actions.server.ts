import { OTP_CHANNEL_HEADER } from "@trush/auth/client";
import type { PhoneOtpChannel } from "@trush/core/schemas/auth";
import { data } from "react-router";

import type { RequestScope } from "../../lib/api.server";
import {
  AUTH_ENDPOINTS,
  forwardSetCookies,
  postAuth,
} from "../auth/api.server";
import { parseAuthForm } from "../auth/form-schema";
import { phoneErrorMessage } from "./errors.server";
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

const sentNotice = (channel: PhoneOtpChannel, phoneNumber: string): string =>
  `Kode dikirim lewat ${CHANNEL_LABELS[channel]} ke ${phoneNumber}.`;

/**
 * Kirim OTP ke nomor baru (pengguna login). Kanal lewat `x-otp-channel`,
 * token Turnstile lewat `x-captcha-response`. Dipakai langkah isi nomor
 * maupun "kirim ulang" di langkah verifikasi.
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
    if (failStep === "verify" && rawPhone) {
      const result: VerifyStepResult = {
        channel: rawChannel,
        formError:
          fields.formError ?? Object.values(fields.fieldErrors ?? {})[0],
        phoneNumber: rawPhone,
        step: "verify",
      };
      return reply(result, status ? { status } : undefined);
    }
    const result: SendStepResult = {
      ...fields,
      step: "send",
      values: { channel: rawChannel, phoneNumber: rawPhone },
    };
    return reply(result, status ? { status } : undefined);
  };

  const parsed = parseAuthForm(sendOtpFormSchema, formData, phoneFieldMessage);
  if (!parsed.success) {
    return failure({ fieldErrors: parsed.fieldErrors });
  }
  const { captchaToken, channel, phoneNumber } = parsed.data;
  const response = await postAuth(scope, {
    body: { phoneNumber },
    captchaToken,
    endpoint: AUTH_ENDPOINTS.phoneSendOtp,
    headers: { [OTP_CHANNEL_HEADER]: channel },
  });
  if (!response.ok) {
    return failure(
      { formError: await phoneErrorMessage(response, "send") },
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
    return reply(
      {
        channel,
        formError: await phoneErrorMessage(response, "verify"),
        phoneNumber,
        step: "verify",
      },
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
