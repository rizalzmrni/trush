import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  alertTexts,
  installFakeTurnstile,
  renderInRouter,
} from "../../testing/auth-forms";
import { TEST_ENV } from "../../testing/cloudflare";
import { EmailVerification } from "./verification";

installFakeTurnstile();

const SITE_KEY = TEST_ENV.VITE_TURNSTILE_SITE_KEY;
const EMAIL = "budi@example.test";

/** Nilai field tersembunyi per form, urut sesuai DOM. */
const hiddenValues = (name: string): string[] =>
  [...document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)].map(
    (input) => input.value
  );

describe(EmailVerification, () => {
  it("email dari URL → langkah kode: field 6 digit dan pesan asal", async () => {
    renderInRouter(
      <EmailVerification
        email={EMAIL}
        notice="Akun berhasil dibuat."
        redirectTo="/org/acme"
        turnstileSiteKey={SITE_KEY}
      />
    );

    await expect(
      screen.findByLabelText("Kode verifikasi")
    ).resolves.toMatchObject({
      inputMode: "numeric",
      maxLength: 6,
      minLength: 6,
      name: "otp",
    });
    expect(screen.getByText("Akun berhasil dibuat.")).toBeTruthy();
    expect(screen.getByText(EMAIL)).toBeTruthy();
  });

  it("langkah kode: form verifikasi + kirim ulang membawa intent dan redirectTo", async () => {
    renderInRouter(
      <EmailVerification
        email={EMAIL}
        notice={null}
        redirectTo="/org/acme"
        turnstileSiteKey={SITE_KEY}
      />
    );

    await expect(
      screen.findByRole("button", { name: "Verifikasi email" })
    ).resolves.toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Kirim ulang kode" })
    ).toBeTruthy();
    expect(hiddenValues("intent")).toStrictEqual([
      "verify-code",
      "resend-code",
    ]);
    expect(hiddenValues("redirectTo")).toStrictEqual([
      "/org/acme",
      "/org/acme",
    ]);
  });

  it("tanpa email → langkah isi email dengan Turnstile", async () => {
    renderInRouter(
      <EmailVerification
        email={null}
        notice={null}
        redirectTo="/"
        turnstileSiteKey={SITE_KEY}
      />
    );

    await expect(screen.findByLabelText("Email")).resolves.toHaveProperty(
      "type",
      "email"
    );
    expect(screen.queryByLabelText("Kode verifikasi")).toBeNull();
    expect(hiddenValues("intent")).toStrictEqual(["send-code"]);
    expect(
      screen.getByRole("button", { name: "Kirim kode verifikasi" })
    ).toBeTruthy();
  });

  it("hasil verify gagal → pesan error, pesan sukses lama disembunyikan", async () => {
    renderInRouter(
      <EmailVerification
        email={EMAIL}
        notice="Akun berhasil dibuat."
        redirectTo="/"
        result={{
          email: EMAIL,
          fieldErrors: { otp: "Masukkan 6 digit kode dari email." },
          formError: "Kode salah. Periksa lagi lalu coba kembali.",
          step: "verify",
        }}
        turnstileSiteKey={SITE_KEY}
      />
    );

    await expect(alertTexts()).resolves.toStrictEqual(
      expect.arrayContaining([
        "Kode salah. Periksa lagi lalu coba kembali.",
        "Masukkan 6 digit kode dari email.",
      ])
    );
    expect(screen.queryByText("Akun berhasil dibuat.")).toBeNull();
  });

  it("hasil kirim ulang sukses → pesan kode terkirim di langkah kode", async () => {
    renderInRouter(
      <EmailVerification
        email={null}
        notice={null}
        redirectTo="/"
        result={{
          email: EMAIL,
          notice: "Kode baru sudah dikirim.",
          step: "verify",
        }}
        turnstileSiteKey={SITE_KEY}
      />
    );

    await expect(
      screen.findByText("Kode baru sudah dikirim.")
    ).resolves.toBeTruthy();
    expect(screen.getByLabelText("Kode verifikasi")).toBeTruthy();
  });

  it("hasil request gagal → langkah isi email dengan email diisi ulang", async () => {
    renderInRouter(
      <EmailVerification
        email={EMAIL}
        notice={null}
        redirectTo="/"
        result={{
          fieldErrors: { email: "Masukkan email yang valid." },
          step: "request",
          values: { email: "budi@" },
        }}
        turnstileSiteKey={SITE_KEY}
      />
    );

    await expect(screen.findByLabelText("Email")).resolves.toHaveProperty(
      "value",
      "budi@"
    );
    await expect(alertTexts()).resolves.toContain("Masukkan email yang valid.");
  });

  it("langkah buat kata sandi: pesan tautan terkirim, tanpa form kode, tautan minta lagi", async () => {
    renderInRouter(
      <EmailVerification
        email={EMAIL}
        notice="Akun berhasil dibuat."
        redirectTo="/"
        result={{ email: EMAIL, step: "password-setup" }}
        turnstileSiteKey={SITE_KEY}
      />
    );

    await expect(screen.findByRole("status")).resolves.toHaveProperty(
      "textContent",
      expect.stringContaining(`Kami mengirim tautan ke ${EMAIL}`)
    );
    expect(screen.queryByLabelText("Kode verifikasi")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Tidak menerima tautan? Minta lagi" })
    ).toHaveProperty("pathname", "/forgot-password");
  });
});
