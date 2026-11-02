import { data, redirect } from "react-router";

import type { RequestScope } from "../../lib/api.server";
import { AUTH_ENDPOINTS, postAuth } from "../auth/api.server";
import { emailAuthError } from "../auth/email-errors.server";
import { parseAuthForm } from "../auth/form-schema";
import { AUTH_NOTICES, NOTICE_PARAM } from "../auth/notices";
import { authPath, getSafeRedirect, SIGN_IN_PATH } from "../auth/safe-redirect";
import {
  INTENT_FIELD,
  isVerifyEmailIntent,
  sendCodeFormSchema,
  VERIFY_EMAIL_INTENTS,
  verifyCodeFormSchema,
  verifyEmailFieldMessage,
} from "./form-schema";
import type {
  RequestStepResult,
  VerifyEmailActionResult,
  VerifyStepResult,
} from "./form-schema";

const HTTP_BAD_REQUEST = 400;

const SEND_LIMIT_SUBJECT = "Terlalu banyak permintaan kode.";
const VERIFY_LIMIT_SUBJECT = "Terlalu banyak percobaan kode.";

const formText = (formData: FormData, name: string): string | undefined => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : undefined;
};

const reply = (result: VerifyEmailActionResult, status = HTTP_BAD_REQUEST) =>
  data(result, { status });

/**
 * Respons api identik untuk email terdaftar/tidak/sudah terverifikasi, jadi
 * pesan juga tidak membedakannya.
 */
const sentNotice = (email: string): string =>
  `Bila ${email} terdaftar dan belum terverifikasi, kode baru sudah dikirim ke sana. Periksa juga folder spam.`;

/**
 * Kirim (ulang) kode verifikasi. `failStep` menentukan langkah yang
 * ditampilkan bila gagal: `request` (form isi email) atau `verify` (form
 * kirim ulang di bawah form kode).
 */
const sendCode = async (
  scope: RequestScope,
  formData: FormData,
  failStep: "request" | "verify"
) => {
  const rawEmail = formText(formData, "email");
  const parsed = parseAuthForm(
    sendCodeFormSchema,
    formData,
    verifyEmailFieldMessage
  );
  const failure = (
    fields: Pick<RequestStepResult, "fieldErrors" | "formError">,
    status?: number
  ) => {
    if (failStep === "verify" && rawEmail && !fields.fieldErrors?.email) {
      const result: VerifyStepResult = {
        email: rawEmail,
        step: "verify",
        ...fields,
      };
      return reply(result, status);
    }
    const result: RequestStepResult = {
      ...fields,
      step: "request",
      values: { email: rawEmail },
    };
    return reply(result, status);
  };

  if (!parsed.success) {
    return failure({ fieldErrors: parsed.fieldErrors });
  }
  const { captchaToken, email, type } = parsed.data;
  const response = await postAuth(scope, {
    body: { email, type },
    captchaToken,
    endpoint: AUTH_ENDPOINTS.emailSendVerificationOtp,
  });
  if (!response.ok) {
    const error = await emailAuthError(response, SEND_LIMIT_SUBJECT);
    return failure({ formError: error.message }, response.status);
  }
  const result: VerifyStepResult = {
    email,
    notice: sentNotice(email),
    step: "verify",
  };
  return data(result);
};

/**
 * Cek kode. Sukses tidak membuat sesi → ke `/sign-in` dengan pesan sukses,
 * membawa `redirectTo` agar pengguna mendarat di tujuan semula setelah login.
 */
const verifyCode = async (scope: RequestScope, formData: FormData) => {
  const rawEmail = formText(formData, "email") ?? "";
  const parsed = parseAuthForm(
    verifyCodeFormSchema,
    formData,
    verifyEmailFieldMessage
  );
  if (!parsed.success) {
    if (parsed.fieldErrors.email) {
      return reply({
        fieldErrors: { email: parsed.fieldErrors.email },
        step: "request",
        values: { email: rawEmail },
      });
    }
    return reply({
      email: rawEmail,
      fieldErrors: parsed.fieldErrors,
      step: "verify",
    });
  }
  const { email, otp } = parsed.data;
  const response = await postAuth(scope, {
    body: { email, otp },
    endpoint: AUTH_ENDPOINTS.emailVerify,
  });
  if (!response.ok) {
    const error = await emailAuthError(response, VERIFY_LIMIT_SUBJECT);
    return reply(
      { email, formError: error.message, step: "verify" },
      response.status
    );
  }
  return redirect(
    authPath(SIGN_IN_PATH, getSafeRedirect(formData.get("redirectTo")), {
      email,
      [NOTICE_PARAM]: AUTH_NOTICES.emailVerified,
    })
  );
};

/** `POST /verify-email`: kirim kode, kirim ulang, atau verifikasi kode. */
export const verifyEmailAction = async (scope: RequestScope) => {
  const formData = await scope.request.formData();
  const intent = formData.get(INTENT_FIELD);
  if (!isVerifyEmailIntent(intent)) {
    return reply({
      formError: "Permintaan tidak dikenal. Muat ulang halaman.",
      step: "request",
      values: {},
    });
  }
  switch (intent) {
    case VERIFY_EMAIL_INTENTS.send: {
      return sendCode(scope, formData, "request");
    }
    case VERIFY_EMAIL_INTENTS.resend: {
      return sendCode(scope, formData, "verify");
    }
    default: {
      return verifyCode(scope, formData);
    }
  }
};
