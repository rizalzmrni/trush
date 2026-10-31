import { screen } from "@testing-library/react";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@trush/core/schemas/auth";
import { describe, expect, it } from "vitest";

import {
  alertTexts,
  renderInRouter,
  installFakeTurnstile,
} from "../../../testing/auth-forms";
import { TEST_ENV } from "../../../testing/cloudflare";
import { SignUpForm } from "./sign-up";

installFakeTurnstile();

const SITE_KEY = TEST_ENV.VITE_TURNSTILE_SITE_KEY;

describe(SignUpForm, () => {
  it("merender nama, email, kata sandi dengan batas panjang, dan tombol Daftar", async () => {
    renderInRouter(<SignUpForm redirectTo="/" turnstileSiteKey={SITE_KEY} />);

    await expect(screen.findByLabelText("Nama")).resolves.toHaveProperty(
      "required",
      true
    );
    expect(screen.getByLabelText("Email")).toHaveProperty("type", "email");
    expect(screen.getByLabelText("Kata sandi")).toMatchObject({
      maxLength: PASSWORD_MAX_LENGTH,
      minLength: PASSWORD_MIN_LENGTH,
      type: "password",
    });
    expect(
      screen.getByText(`Minimal ${PASSWORD_MIN_LENGTH} karakter.`)
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Daftar" })).toBeTruthy();
  });

  it("menampilkan error captcha dan mengisi ulang nama & email", async () => {
    renderInRouter(
      <SignUpForm
        redirectTo="/"
        result={{
          fieldErrors: {
            captchaToken: "Selesaikan verifikasi keamanan terlebih dahulu.",
          },
          values: { email: "budi@example.test", name: "Budi" },
        }}
        turnstileSiteKey={SITE_KEY}
      />
    );

    await expect(alertTexts()).resolves.toContain(
      "Selesaikan verifikasi keamanan terlebih dahulu."
    );
    expect(screen.getByLabelText("Nama")).toHaveProperty("value", "Budi");
    expect(screen.getByLabelText("Email")).toHaveProperty(
      "value",
      "budi@example.test"
    );
  });
});
