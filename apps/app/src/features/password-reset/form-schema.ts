import {
  forgotPasswordInputSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  resetPasswordInputSchema,
} from "@trush/core/schemas/auth";
import { z } from "zod";

import { fieldMessage } from "../auth/form-schema";
import type { FieldErrors, IssueLike } from "../auth/form-schema";

/** Query string tautan reset dari api: `?token=…` atau `?error=INVALID_TOKEN`. */
export const TOKEN_PARAM = "token";
export const ERROR_PARAM = "error";

// Kontrak input dari `@trush/core`; form lupa kata sandi menambah token
// Turnstile (header `x-captcha-response`). `redirectTo` diisi action.
export const forgotPasswordFormSchema = forgotPasswordInputSchema.extend({
  captchaToken: z.string().min(1),
});

export const resetPasswordFormSchema = resetPasswordInputSchema;

export type ForgotPasswordForm = z.infer<typeof forgotPasswordFormSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordFormSchema>;

/** Pesan Indonesia per field form lupa/reset kata sandi. */
export const passwordResetFieldMessage = (issue: IssueLike): string => {
  const [field] = issue.path ?? [];
  switch (field) {
    case "newPassword": {
      return issue.code === "too_big"
        ? `Kata sandi maksimal ${PASSWORD_MAX_LENGTH} karakter.`
        : `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`;
    }
    case "token": {
      return "Tautan reset tidak lengkap. Buka lagi tautan dari email.";
    }
    default: {
      return fieldMessage(issue);
    }
  }
};

/** Hasil action `/forgot-password`. */
export type ForgotPasswordResult =
  | {
      readonly status: "error";
      readonly fieldErrors?: FieldErrors<ForgotPasswordForm>;
      readonly formError?: string;
      readonly values: { readonly email?: string };
    }
  /** Dikirim (atau email tidak terdaftar; tampilannya sengaja sama). */
  | { readonly status: "sent"; readonly email: string };

/** Hasil action `/reset-password` yang gagal (sukses → redirect). */
export type ResetPasswordResult =
  | {
      readonly status: "error";
      readonly fieldErrors?: FieldErrors<ResetPasswordForm>;
      readonly formError?: string;
    }
  /** Token tidak sah/kedaluwarsa/terpakai: minta tautan baru. */
  | { readonly status: "invalid-token" };
