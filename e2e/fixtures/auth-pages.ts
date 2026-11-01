import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { TURNSTILE_DUMMY_TOKEN } from "./turnstile";
import type { TestUser } from "./users";

/**
 * Token Turnstile baru disisipkan setelah hydration; submit sebelum itu
 * dikirim tanpa token dan ditolak. Input tersembunyi tidak punya peran ARIA,
 * jadi dicari lewat `name` (nama field dari widget, bukan detail styling).
 */
const expectCaptchaReady = async (page: Page): Promise<void> => {
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(
    TURNSTILE_DUMMY_TOKEN
  );
};

const withRedirect = (path: string, redirectTo?: string): string =>
  redirectTo ? `${path}?${new URLSearchParams({ redirectTo })}` : path;

/** Halaman `/sign-up` `apps/app`. */
export const createSignUpPage = (page: Page) => {
  const heading = page.getByRole("heading", { name: "Daftar ke trush" });
  return {
    /** Pesan gagal tingkat form (`role="alert"`). */
    formError: page.getByRole("alert"),
    async goto(redirectTo?: string): Promise<void> {
      await page.goto(withRedirect("/sign-up", redirectTo));
      await expect(heading).toBeVisible();
    },
    heading,
    async signUp({ email, name, password }: TestUser): Promise<void> {
      await expectCaptchaReady(page);
      await page.getByLabel("Nama").fill(name);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Kata sandi").fill(password);
      await page.getByRole("button", { exact: true, name: "Daftar" }).click();
    },
  };
};

/** Halaman `/sign-in` `apps/app`. */
export const createSignInPage = (page: Page) => {
  const heading = page.getByRole("heading", { name: "Masuk ke trush" });
  return {
    /** Pesan gagal tingkat form (`role="alert"`). */
    formError: page.getByRole("alert"),
    async goto(redirectTo?: string): Promise<void> {
      await page.goto(withRedirect("/sign-in", redirectTo));
      await expect(heading).toBeVisible();
    },
    heading,
    async signIn({
      email,
      password,
    }: Pick<TestUser, "email" | "password">): Promise<void> {
      await expectCaptchaReady(page);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Kata sandi").fill(password);
      await page.getByRole("button", { exact: true, name: "Masuk" }).click();
    },
  };
};

/** Beranda `/` (terproteksi) `apps/app`. */
export const createHomePage = (page: Page) => {
  const heading = page.getByRole("heading", { level: 1, name: "Beranda" });
  return {
    /** Beranda tampil untuk pengguna ini (kartu profil berisi nama + email). */
    async expectSignedInAs({
      email,
      name,
    }: Pick<TestUser, "email" | "name">): Promise<void> {
      await expect(heading).toBeVisible();
      const profile = page.getByRole("region", { name: "Profil" });
      await expect(profile.getByRole("heading", { name })).toBeVisible();
      await expect(profile.getByText(email)).toBeVisible();
    },
    heading,
    signOutButton: page.getByRole("button", { name: "Keluar" }),
  };
};

export type SignUpPage = ReturnType<typeof createSignUpPage>;
export type SignInPage = ReturnType<typeof createSignInPage>;
export type HomePage = ReturnType<typeof createHomePage>;
