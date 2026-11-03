import { EMAIL_AUTH_ERROR_CODES } from "@trush/core/schemas/auth";
import { data, redirect } from "react-router";

import type { RequestScope } from "../../lib/api.server";
import { AUTH_ENDPOINTS, postAuth } from "../auth/api.server";
import { emailAuthError } from "../auth/email-errors.server";
import { parseAuthForm } from "../auth/form-schema";
import { AUTH_NOTICES, NOTICE_PARAM } from "../auth/notices";
import {
  authPath,
  RESET_PASSWORD_PATH,
  SIGN_IN_PATH,
} from "../auth/safe-redirect";
import {
  forgotPasswordFormSchema,
  passwordResetFieldMessage,
  resetPasswordFormSchema,
} from "./form-schema";
import type { ForgotPasswordResult, ResetPasswordResult } from "./form-schema";

const HTTP_BAD_REQUEST = 400;

const REQUEST_LIMIT_SUBJECT = "Terlalu banyak permintaan reset kata sandi.";
const RESET_LIMIT_SUBJECT = "Terlalu banyak percobaan.";

/**
 * URL absolut halaman reset di app ini, untuk tautan di email. Diambil dari
 * origin request (domain publik app di Worker); api menolaknya bila origin
 * tidak termasuk `trustedOrigins`.
 */
const resetPageUrl = (request: Request): string =>
  new URL(RESET_PASSWORD_PATH, request.url).toString();

/**
 * `POST /forgot-password`: minta tautan reset. Respons api identik untuk
 * email terdaftar/tidak, jadi halaman juga menampilkan pesan yang sama.
 */
export const forgotPasswordAction = async (scope: RequestScope) => {
  const formData = await scope.request.formData();
  const rawEmail = formData.get("email");
  const values = {
    email: typeof rawEmail === "string" ? rawEmail.trim() : undefined,
  };
  const parsed = parseAuthForm(
    forgotPasswordFormSchema,
    formData,
    passwordResetFieldMessage
  );
  if (!parsed.success) {
    return data(
      {
        fieldErrors: parsed.fieldErrors,
        status: "error",
        values,
      } satisfies ForgotPasswordResult,
      { status: HTTP_BAD_REQUEST }
    );
  }
  const { captchaToken, email } = parsed.data;
  const response = await postAuth(scope, {
    body: { email, redirectTo: resetPageUrl(scope.request) },
    captchaToken,
    endpoint: AUTH_ENDPOINTS.passwordRequestReset,
  });
  if (!response.ok) {
    const error = await emailAuthError(response, REQUEST_LIMIT_SUBJECT);
    return data(
      {
        formError: error.message,
        status: "error",
        values,
      } satisfies ForgotPasswordResult,
      { status: response.status }
    );
  }
  return data({ email, status: "sent" } satisfies ForgotPasswordResult);
};

/**
 * `POST /reset-password`: ganti kata sandi dengan token dari tautan email.
 * Sukses → semua sesi dicabut api → ke `/sign-in` dengan pesan sukses.
 */
export const resetPasswordAction = async (scope: RequestScope) => {
  const formData = await scope.request.formData();
  const parsed = parseAuthForm(
    resetPasswordFormSchema,
    formData,
    passwordResetFieldMessage
  );
  if (!parsed.success) {
    if (parsed.fieldErrors.token) {
      return data({ status: "invalid-token" } satisfies ResetPasswordResult, {
        status: HTTP_BAD_REQUEST,
      });
    }
    return data(
      {
        fieldErrors: parsed.fieldErrors,
        status: "error",
      } satisfies ResetPasswordResult,
      { status: HTTP_BAD_REQUEST }
    );
  }
  const { newPassword, token } = parsed.data;
  const response = await postAuth(scope, {
    body: { newPassword, token },
    endpoint: AUTH_ENDPOINTS.passwordReset,
  });
  if (!response.ok) {
    const error = await emailAuthError(response, RESET_LIMIT_SUBJECT);
    if (error.code === EMAIL_AUTH_ERROR_CODES.invalidToken) {
      return data({ status: "invalid-token" } satisfies ResetPasswordResult, {
        status: response.status,
      });
    }
    return data(
      {
        // Aturan kata sandi (terlalu pendek/bocor) ditampilkan di field.
        ...(error.code?.startsWith("PASSWORD_")
          ? { fieldErrors: { newPassword: error.message } }
          : { formError: error.message }),
        status: "error",
      } satisfies ResetPasswordResult,
      { status: response.status }
    );
  }
  return redirect(
    authPath(SIGN_IN_PATH, undefined, {
      [NOTICE_PARAM]: AUTH_NOTICES.passwordReset,
    })
  );
};
