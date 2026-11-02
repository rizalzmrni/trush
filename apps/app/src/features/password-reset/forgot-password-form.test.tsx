import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  alertTexts,
  installFakeTurnstile,
  renderInRouter,
} from "../../testing/auth-forms";
import { TEST_ENV } from "../../testing/cloudflare";
import { ForgotPasswordForm } from "./forgot-password-form";

installFakeTurnstile();

const SITE_KEY = TEST_ENV.VITE_TURNSTILE_SITE_KEY;

describe(ForgotPasswordForm, () => {
  it("kunjungan pertama: email + tombol kirim tautan", async () => {
    renderInRouter(<ForgotPasswordForm turnstileSiteKey={SITE_KEY} />);

    await expect(screen.findByLabelText("Email")).resolves.toHaveProperty(
      "required",
      true
    );
    expect(
      screen.getByRole("button", { name: "Kirim tautan reset" })
    ).toBeTruthy();
  });

  it("terkirim: pesan netral (tidak memastikan email terdaftar) + kirim ulang", async () => {
    renderInRouter(
      <ForgotPasswordForm
        result={{ email: "budi@example.test", status: "sent" }}
        turnstileSiteKey={SITE_KEY}
      />
    );

    await expect(
      screen.findByText(/Bila budi@example\.test terdaftar/u)
    ).resolves.toBeTruthy();
    expect(screen.getByLabelText("Email")).toHaveProperty(
      "value",
      "budi@example.test"
    );
    expect(
      screen.getByRole("button", { name: "Kirim ulang tautan" })
    ).toBeTruthy();
  });

  it("gagal: pesan form + error field, email diisi ulang", async () => {
    renderInRouter(
      <ForgotPasswordForm
        result={{
          fieldErrors: {
            captchaToken: "Selesaikan verifikasi keamanan terlebih dahulu.",
          },
          formError: "Terlalu banyak permintaan reset kata sandi.",
          status: "error",
          values: { email: "budi@example.test" },
        }}
        turnstileSiteKey={SITE_KEY}
      />
    );

    await expect(alertTexts()).resolves.toStrictEqual(
      expect.arrayContaining([
        "Terlalu banyak permintaan reset kata sandi.",
        "Selesaikan verifikasi keamanan terlebih dahulu.",
      ])
    );
    expect(screen.getByLabelText("Email")).toHaveProperty(
      "value",
      "budi@example.test"
    );
  });
});
