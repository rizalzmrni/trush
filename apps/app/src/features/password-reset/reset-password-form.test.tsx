import { cleanup, screen } from "@testing-library/react";
import { PASSWORD_MIN_LENGTH } from "@trush/core/schemas/auth";
import { afterEach, describe, expect, it } from "vitest";

import { alertTexts, renderInRouter } from "../../testing/auth-forms";
import { ResetPasswordForm } from "./reset-password-form";

describe(ResetPasswordForm, () => {
  afterEach(() => {
    cleanup();
  });

  it("field kata sandi baru + token tersembunyi", async () => {
    renderInRouter(<ResetPasswordForm token="tok-palsu" />);

    await expect(
      screen.findByLabelText("Kata sandi baru")
    ).resolves.toMatchObject({
      minLength: PASSWORD_MIN_LENGTH,
      required: true,
      type: "password",
    });
    expect(
      document.querySelector<HTMLInputElement>('input[name="token"]')?.value
    ).toBe("tok-palsu");
    expect(
      screen.getByRole("button", { name: "Simpan kata sandi baru" })
    ).toBeTruthy();
  });

  it("error field dan form ditampilkan", async () => {
    renderInRouter(
      <ResetPasswordForm
        result={{
          fieldErrors: { newPassword: "Kata sandi ini pernah bocor." },
          formError: "Terjadi kesalahan.",
          status: "error",
        }}
        token="tok-palsu"
      />
    );

    await expect(alertTexts()).resolves.toStrictEqual(
      expect.arrayContaining([
        "Kata sandi ini pernah bocor.",
        "Terjadi kesalahan.",
      ])
    );
  });
});
