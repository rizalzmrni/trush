import { randomUUID } from "node:crypto";

import { expect, request } from "@playwright/test";

import { verifyEmailViaApi } from "./email";
import { TURNSTILE_DUMMY_TOKEN } from "./turnstile";
import { API_URL, APP_URL } from "./urls";

/** Header token Turnstile (`CAPTCHA_HEADER` di `@trush/auth/client`). */
export const CAPTCHA_HEADER = "x-captcha-response";

export interface TestUser {
  readonly email: string;
  readonly name: string;
  readonly password: string;
}

/**
 * Pengguna unik per test (test paralel tidak berbagi akun). Domain
 * `example.com` (RFC 2606) tidak pernah menerima email sungguhan; kata sandi
 * acak agar tidak ditolak `haveIBeenPwned`.
 */
export const uniqueUser = (label = "user"): TestUser => {
  const id = randomUUID();
  return {
    email: `e2e-${label}-${id}@example.com`,
    name: `E2E ${label}`,
    password: `E2e-${id}-Pw!`,
  };
};

/**
 * Header request langsung ke api: `origin` app (cek CSRF/trustedOrigins
 * better-auth) dan token Turnstile dummy.
 */
export const apiHeaders = (): Record<string, string> => ({
  [CAPTCHA_HEADER]: TURNSTILE_DUMMY_TOKEN,
  origin: APP_URL,
});

/**
 * Buat akun lewat api tanpa verifikasi email: login ditolak 403
 * `EMAIL_NOT_VERIFIED` sampai kode dari outbox dimasukkan.
 */
export const createUnverifiedUserViaApi = async (
  user: TestUser = uniqueUser()
): Promise<TestUser> => {
  const api = await request.newContext({ baseURL: API_URL });
  try {
    const response = await api.post("/api/auth/sign-up/email", {
      data: user,
      headers: apiHeaders(),
    });
    expect(response.status(), await response.text()).toBe(200);
    return user;
  } finally {
    await api.dispose();
  }
};

/**
 * Buat akun lewat api (bukan UI) untuk test yang tidak menguji daftar, lalu
 * verifikasi emailnya dengan kode dari `/__e2e/outbox` (tanpa itu login
 * ditolak). Context request terpisah dan langsung dibuang: tidak ada cookie
 * yang bocor ke browser test.
 */
export const createUserViaApi = async (
  user: TestUser = uniqueUser()
): Promise<TestUser> => {
  await createUnverifiedUserViaApi(user);
  await verifyEmailViaApi(user.email);
  return user;
};
