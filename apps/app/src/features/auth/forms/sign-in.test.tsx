import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  alertTexts,
  fakeTurnstile,
  installFakeTurnstile,
  renderInRouter,
} from "../../../testing/auth-forms";
import { TEST_ENV } from "../../../testing/cloudflare";
import { TURNSTILE_FIELD } from "../form-schema";
import { SignInForm } from "./sign-in";

installFakeTurnstile();

const SITE_KEY = TEST_ENV.VITE_TURNSTILE_SITE_KEY;

describe(SignInForm, () => {
  it("merender field berlabel dan tombol Masuk tanpa error", async () => {
    renderInRouter(<SignInForm redirectTo="/" turnstileSiteKey={SITE_KEY} />);

    const email = await screen.findByLabelText("Email");
    expect(email).toMatchObject({ required: true, type: "email" });
    expect(screen.getByLabelText("Kata sandi")).toHaveProperty(
      "type",
      "password"
    );
    expect(screen.getByRole("button", { name: "Masuk" })).toBeTruthy();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("form POST membawa redirectTo tersembunyi", async () => {
    const { container } = renderInRouter(
      <SignInForm redirectTo="/billing" turnstileSiteKey={SITE_KEY} />
    );

    await screen.findByLabelText("Email");
    expect(container.querySelector("form")?.getAttribute("method")).toBe(
      "post"
    );
    const hidden = container.querySelector<HTMLInputElement>(
      'input[name="redirectTo"]'
    );
    expect(hidden).toMatchObject({ type: "hidden", value: "/billing" });
  });

  it("memasang widget Turnstile dengan site key dan field token", async () => {
    renderInRouter(<SignInForm redirectTo="/" turnstileSiteKey={SITE_KEY} />);

    await waitFor(() => {
      expect(fakeTurnstile.render).toHaveBeenCalledOnce();
    });
    expect(fakeTurnstile.render.mock.calls[0]?.[1]).toMatchObject({
      "response-field-name": TURNSTILE_FIELD,
      sitekey: SITE_KEY,
    });
  });

  it("menampilkan error form & field, mengisi ulang email", async () => {
    renderInRouter(
      <SignInForm
        redirectTo="/"
        result={{
          fieldErrors: { password: "Masukkan kata sandi." },
          formError: "Email atau kata sandi salah.",
          values: { email: "budi@example.test" },
        }}
        turnstileSiteKey={SITE_KEY}
      />
    );

    await expect(alertTexts()).resolves.toContain(
      "Email atau kata sandi salah."
    );
    const password = screen.getByLabelText("Kata sandi");
    expect(password.getAttribute("aria-invalid")).toBe("true");
    const describedBy = password.getAttribute("aria-describedby") ?? "";
    expect(document.querySelector(`#${describedBy}`)?.textContent).toBe(
      "Masukkan kata sandi."
    );
    expect(screen.getByLabelText("Email")).toHaveProperty(
      "value",
      "budi@example.test"
    );
  });

  it("widget gagal → pesan alert", async () => {
    renderInRouter(<SignInForm redirectTo="/" turnstileSiteKey={SITE_KEY} />);

    await waitFor(() => {
      expect(fakeTurnstile.render).toHaveBeenCalledOnce();
    });
    const onError = fakeTurnstile.render.mock.calls[0]?.[1]["error-callback"];
    expect(onError).toBeTypeOf("function");
    onError?.();

    const texts = await alertTexts();
    expect(
      texts.some((text) => text.includes("Verifikasi keamanan gagal dimuat"))
    ).toBeTruthy();
  });
});
