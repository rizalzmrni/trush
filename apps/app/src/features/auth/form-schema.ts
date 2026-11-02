import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  signInEmailInputSchema,
  signUpEmailInputSchema,
} from "@trush/core/schemas/auth";
import { z } from "zod";

/** Nama field token yang disisipkan widget Turnstile ke dalam form. */
export const TURNSTILE_FIELD = "cf-turnstile-response";

// Kontrak input dari `@trush/core`; form hanya menambah token Turnstile
// (dikirim lewat header `x-captcha-response`, bukan body).
const captchaSchema = z.string().min(1);

export const signInFormSchema = signInEmailInputSchema.extend({
  captchaToken: captchaSchema,
});

export const signUpFormSchema = signUpEmailInputSchema.extend({
  captchaToken: captchaSchema,
});

export type SignInForm = z.infer<typeof signInFormSchema>;
export type SignUpForm = z.infer<typeof signUpFormSchema>;

export type FieldErrors<Fields> = Partial<Record<keyof Fields, string>>;

/** Hasil action form auth yang gagal; diteruskan route ke komponen form. */
export interface AuthActionResult<Fields> {
  readonly fieldErrors?: FieldErrors<Fields>;
  readonly formError?: string;
  /** Nilai yang diisi ulang (tanpa kata sandi & token). */
  readonly values: { readonly email?: string; readonly name?: string };
}

export type ParsedForm<Fields> =
  | { readonly data: Fields; readonly success: true }
  | { readonly fieldErrors: FieldErrors<Fields>; readonly success: false };

export interface IssueLike {
  readonly code?: string;
  readonly minimum?: unknown;
  readonly path?: readonly PropertyKey[];
}

const passwordMessage = ({ code, minimum }: IssueLike): string => {
  if (code === "too_big") {
    return `Kata sandi maksimal ${PASSWORD_MAX_LENGTH} karakter.`;
  }
  // Login hanya mewajibkan terisi (min 1); daftar memakai batas better-auth.
  if (minimum === PASSWORD_MIN_LENGTH) {
    return `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  }
  return "Masukkan kata sandi.";
};

/**
 * Pesan Indonesia per field. Skema kontrak di `@trush/core` sengaja tanpa
 * pesan; pesan tampilan milik app.
 */
export const fieldMessage = (issue: IssueLike): string => {
  const [field] = issue.path ?? [];
  switch (field) {
    case "captchaToken": {
      return "Selesaikan verifikasi keamanan terlebih dahulu.";
    }
    case "email": {
      return "Masukkan alamat email yang valid.";
    }
    case "name": {
      return issue.code === "too_big"
        ? `Nama maksimal ${NAME_MAX_LENGTH} karakter.`
        : "Masukkan nama kamu.";
    }
    case "password": {
      return passwordMessage(issue);
    }
    default: {
      return "Isian tidak valid.";
    }
  }
};

const formString = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

/**
 * Baca & validasi `FormData` form auth. Token Turnstile dibaca dari field
 * bawaan widget; email dipangkas spasinya. Error dikembalikan satu pesan per
 * field.
 */
export const parseAuthForm = <Schema extends z.ZodObject>(
  schema: Schema,
  formData: FormData,
  /** Pesan per field; fitur lain (mis. telepon) memberi pemetaannya sendiri. */
  messageFor: (issue: IssueLike) => string = fieldMessage
): ParsedForm<z.output<Schema>> => {
  const input: Record<string, string> = {
    captchaToken: formString(formData, TURNSTILE_FIELD),
  };
  for (const key of Object.keys(schema.shape)) {
    if (key !== "captchaToken") {
      input[key] = formString(formData, key);
    }
  }
  if (input.email !== undefined) {
    input.email = input.email.trim();
  }
  const result = schema.safeParse(input);
  if (result.success) {
    return { data: result.data, success: true };
  }
  const fieldErrors: FieldErrors<z.output<Schema>> = {};
  for (const issue of result.error.issues) {
    const [field] = issue.path;
    if (typeof field === "string" && !(field in fieldErrors)) {
      fieldErrors[field as keyof z.output<Schema>] = messageFor(issue);
    }
  }
  return { fieldErrors, success: false };
};
