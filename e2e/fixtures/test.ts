import { test as base } from "@playwright/test";

import {
  createHomePage,
  createSignInPage,
  createSignUpPage,
} from "./auth-pages";
import type { HomePage, SignInPage, SignUpPage } from "./auth-pages";
import { createPasswordResetPages, createVerifyEmailPage } from "./email";
import type { PasswordResetPages, VerifyEmailPage } from "./email";
import { createPhoneSettingsPage } from "./phone";
import type { PhoneSettingsPage } from "./phone";
import { stubTurnstile } from "./turnstile";

interface AuthPages {
  homePage: HomePage;
  passwordReset: PasswordResetPages;
  phoneSettings: PhoneSettingsPage;
  signInPage: SignInPage;
  signUpPage: SignUpPage;
  verifyEmailPage: VerifyEmailPage;
}

/**
 * `test` e2e trush: setiap browser context memakai stub Turnstile (tanpa
 * skrip pihak ketiga), plus page object halaman auth. Parameter kedua fixture
 * dinamai `provide` (bukan `use`) agar tidak dikira React Hook oleh linter.
 */
export const test = base.extend<AuthPages>({
  context: async ({ context }, provide) => {
    await stubTurnstile(context);
    await provide(context);
  },
  homePage: async ({ page }, provide) => {
    await provide(createHomePage(page));
  },
  passwordReset: async ({ page }, provide) => {
    await provide(createPasswordResetPages(page));
  },
  phoneSettings: async ({ page }, provide) => {
    await provide(createPhoneSettingsPage(page));
  },
  signInPage: async ({ page }, provide) => {
    await provide(createSignInPage(page));
  },
  signUpPage: async ({ page }, provide) => {
    await provide(createSignUpPage(page));
  },
  verifyEmailPage: async ({ page }, provide) => {
    await provide(createVerifyEmailPage(page));
  },
});

/** Context tanpa sesi, untuk test yang membuat/memakai pengguna sendiri. */
export const NO_SESSION = { cookies: [], origins: [] };

export { expect } from "@playwright/test";
