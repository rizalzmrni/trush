import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@trush/core/schemas/auth";
import { describe, expect, it } from "vitest";

import {
  parseAuthForm,
  signInFormSchema,
  signUpFormSchema,
  TURNSTILE_FIELD,
} from "./form-schema";

const formOf = (fields: Record<string, string>): FormData => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
};

const VALID_PASSWORD = "kata-sandi-palsu-1";

describe("parseAuthForm sign-in", () => {
  it("lolos dengan email dipangkas dan token Turnstile dari field widget", () => {
    const result = parseAuthForm(
      signInFormSchema,
      formOf({
        email: "  budi@example.test ",
        password: VALID_PASSWORD,
        [TURNSTILE_FIELD]: "token-turnstile-palsu",
      })
    );

    expect(result).toStrictEqual({
      data: {
        captchaToken: "token-turnstile-palsu",
        email: "budi@example.test",
        password: VALID_PASSWORD,
      },
      success: true,
    });
  });

  it("form kosong → satu pesan per field", () => {
    const result = parseAuthForm(signInFormSchema, new FormData());

    expect(result).toStrictEqual({
      fieldErrors: {
        captchaToken: "Selesaikan verifikasi keamanan terlebih dahulu.",
        email: "Masukkan alamat email yang valid.",
        password: "Masukkan kata sandi.",
      },
      success: false,
    });
  });

  it("menolak email tidak valid", () => {
    const result = parseAuthForm(
      signInFormSchema,
      formOf({
        email: "bukan-email",
        password: VALID_PASSWORD,
        [TURNSTILE_FIELD]: "t",
      })
    );

    expect(result).toStrictEqual({
      fieldErrors: { email: "Masukkan alamat email yang valid." },
      success: false,
    });
  });

  it("token hanya dibaca dari field widget, bukan field captchaToken kiriman klien", () => {
    const result = parseAuthForm(
      signInFormSchema,
      formOf({
        captchaToken: "disisipkan-klien",
        email: "budi@example.test",
        password: VALID_PASSWORD,
      })
    );

    expect(result.success).toBeFalsy();
    expect(result.success ? {} : result.fieldErrors).toHaveProperty(
      "captchaToken"
    );
  });

  it("nilai File diperlakukan sebagai kosong", () => {
    const formData = formOf({
      password: VALID_PASSWORD,
      [TURNSTILE_FIELD]: "t",
    });
    formData.set("email", new File(["x"], "email.txt"));

    const result = parseAuthForm(signInFormSchema, formData);

    expect(result.success ? {} : result.fieldErrors).toStrictEqual({
      email: "Masukkan alamat email yang valid.",
    });
  });
});

describe("parseAuthForm sign-up", () => {
  const valid = {
    email: "budi@example.test",
    name: "Budi",
    password: VALID_PASSWORD,
    [TURNSTILE_FIELD]: "token-turnstile-palsu",
  };

  it("lolos dengan input valid", () => {
    expect(parseAuthForm(signUpFormSchema, formOf(valid))).toStrictEqual({
      data: {
        captchaToken: "token-turnstile-palsu",
        email: "budi@example.test",
        name: "Budi",
        password: VALID_PASSWORD,
      },
      success: true,
    });
  });

  it.each([
    [
      "kata sandi terlalu pendek",
      { password: "a".repeat(PASSWORD_MIN_LENGTH - 1) },
      { password: `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.` },
    ],
    [
      "kata sandi terlalu panjang",
      { password: "a".repeat(PASSWORD_MAX_LENGTH + 1) },
      { password: `Kata sandi maksimal ${PASSWORD_MAX_LENGTH} karakter.` },
    ],
    ["nama kosong", { name: "" }, { name: "Masukkan nama kamu." }],
    ["nama hanya spasi", { name: "   " }, { name: "Masukkan nama kamu." }],
    [
      "nama terlalu panjang",
      { name: "a".repeat(NAME_MAX_LENGTH + 1) },
      { name: `Nama maksimal ${NAME_MAX_LENGTH} karakter.` },
    ],
    [
      "tanpa token Turnstile",
      { [TURNSTILE_FIELD]: "" },
      { captchaToken: "Selesaikan verifikasi keamanan terlebih dahulu." },
    ],
  ])("menolak %s", (_label, override, expected) => {
    expect(
      parseAuthForm(signUpFormSchema, formOf({ ...valid, ...override }))
    ).toStrictEqual({ fieldErrors: expected, success: false });
  });

  it("menerima kata sandi tepat di batas minimal dan maksimal", () => {
    for (const length of [PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH]) {
      const result = parseAuthForm(
        signUpFormSchema,
        formOf({ ...valid, password: "a".repeat(length) })
      );
      expect(result.success).toBeTruthy();
    }
  });
});
