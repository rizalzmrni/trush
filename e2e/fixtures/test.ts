import { test as base } from "@playwright/test";

import {
  createHomePage,
  createSignInPage,
  createSignUpPage,
} from "./auth-pages";
import type { HomePage, SignInPage, SignUpPage } from "./auth-pages";
import { stubTurnstile } from "./turnstile";

interface AuthPages {
  homePage: HomePage;
  signInPage: SignInPage;
  signUpPage: SignUpPage;
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
  signInPage: async ({ page }, provide) => {
    await provide(createSignInPage(page));
  },
  signUpPage: async ({ page }, provide) => {
    await provide(createSignUpPage(page));
  },
});

/** Context tanpa sesi, untuk test yang membuat/memakai pengguna sendiri. */
export const NO_SESSION = { cookies: [], origins: [] };

export { expect } from "@playwright/test";
