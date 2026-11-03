import { expect, request } from "@playwright/test";
import type { Page } from "@playwright/test";

import { expectCaptchaReady } from "./auth-pages";
import { API_URL, APP_URL } from "./urls";

const EMAIL_OTP = /^\d{6}$/u;
const RESET_LINK = /https?:\/\/\S+\/api\/auth\/reset-password\/\S+/u;

/** Bagian kontrak `E2eOutboxMessage` (`@trush/core/schemas/e2e`) untuk email. */
export interface EmailMessage {
  readonly id: string;
  readonly to: string;
  readonly subject: string | null;
  readonly code: string | null;
  readonly body: string;
}

const isEmailMessage = (value: unknown): value is EmailMessage =>
  typeof value === "object" &&
  value !== null &&
  "channel" in value &&
  value.channel === "email" &&
  "id" in value &&
  typeof value.id === "string" &&
  "to" in value &&
  typeof value.to === "string" &&
  "body" in value &&
  typeof value.body === "string" &&
  "code" in value &&
  (typeof value.code === "string" || value.code === null) &&
  "subject" in value &&
  (typeof value.subject === "string" || value.subject === null);

/** Pesan email dari body `E2eOutboxResponse` (terbaru dulu). */
const emailMessages = (body: unknown): EmailMessage[] => {
  const list =
    typeof body === "object" && body !== null && "messages" in body
      ? body.messages
      : undefined;
  return Array.isArray(list) ? list.filter(isEmailMessage) : [];
};

/** Semua email untuk `email` di outbox api (`GET /__e2e/outbox?to=`), terbaru dulu. */
export const listEmails = async (email: string): Promise<EmailMessage[]> => {
  const api = await request.newContext({ baseURL: API_URL });
  try {
    const response = await api.get("/__e2e/outbox", { params: { to: email } });
    expect(response.status()).toBe(200);
    return emailMessages(await response.json());
  } finally {
    await api.dispose();
  }
};

/**
 * Email terbaru untuk `email` yang memenuhi `match`, di-poll karena email
 * auth dikirim di latar (`waitUntil`). `known` = id pesan yang sudah ada
 * sebelum aksi, agar email lama tidak terbaca ulang.
 */
const waitForEmail = async (
  email: string,
  match: (message: EmailMessage) => boolean,
  known: ReadonlySet<string> = new Set()
): Promise<EmailMessage> => {
  let found: EmailMessage | undefined;
  await expect
    .poll(async () => {
      const messages = await listEmails(email);
      found = messages.find(
        (message) => match(message) && !known.has(message.id)
      );
      return found?.id;
    })
    .toBeTruthy();
  if (!found) {
    throw new Error("email tidak ditemukan di outbox");
  }
  return found;
};

/** Id email yang sudah ada untuk `email` (pembanding sebelum aksi). */
export const knownEmailIds = async (email: string): Promise<Set<string>> => {
  const messages = await listEmails(email);
  return new Set(messages.map((message) => message.id));
};

/** Kode verifikasi email terbaru (6 digit) dari outbox. */
export const readEmailOtp = async (
  email: string,
  known?: ReadonlySet<string>
): Promise<string> => {
  const message = await waitForEmail(
    email,
    ({ code }) => code !== null && EMAIL_OTP.test(code),
    known
  );
  return message.code ?? "";
};

/** Tautan reset password utuh dari email terbaru (`body` teks polos). */
export const readResetLink = async (
  email: string,
  known?: ReadonlySet<string>
): Promise<string> => {
  const message = await waitForEmail(
    email,
    ({ body, code }) => code === null && RESET_LINK.test(body),
    known
  );
  return message.body.match(RESET_LINK)?.[0] ?? "";
};

/**
 * Verifikasi email lewat api (`POST /api/auth/email-otp/verify-email`, tanpa
 * captcha) memakai kode dari outbox dan `cookie` dari sign-up (bukti kata
 * sandi B19). Untuk fixture yang tidak menguji UI verifikasi.
 */
export const verifyEmailViaApi = async (
  email: string,
  cookie: string
): Promise<void> => {
  const otp = await readEmailOtp(email);
  const api = await request.newContext({ baseURL: API_URL });
  try {
    const response = await api.post("/api/auth/email-otp/verify-email", {
      data: { email, otp },
      headers: { cookie, origin: APP_URL },
    });
    expect(response.status(), await response.text()).toBe(200);
    // Tanpa cookie sah, api mencabut kata sandi (B19) dan login akan 401.
    expect(await response.json()).toMatchObject({
      passwordSetupRequired: false,
    });
  } finally {
    await api.dispose();
  }
};

/** Halaman `/verify-email` `apps/app`. */
export const createVerifyEmailPage = (page: Page) => {
  const heading = page.getByRole("heading", { name: "Verifikasi email" });
  return {
    formError: page.getByRole("alert"),
    heading,
    notice: page.getByRole("status"),
    /** Kirim ulang kode (butuh Turnstile). */
    async resend(): Promise<void> {
      await expectCaptchaReady(page);
      await page.getByRole("button", { name: "Kirim ulang kode" }).click();
    },
    async submitCode(code: string): Promise<void> {
      await page.getByLabel("Kode verifikasi").fill(code);
      await page.getByRole("button", { name: "Verifikasi email" }).click();
    },
  };
};

/** Halaman `/forgot-password` dan `/reset-password` `apps/app`. */
export const createPasswordResetPages = (page: Page) => ({
  forgotHeading: page.getByRole("heading", { name: "Lupa kata sandi" }),
  formError: page.getByRole("alert"),
  notice: page.getByRole("status"),
  async requestLink(email: string): Promise<void> {
    await expectCaptchaReady(page);
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Kirim tautan reset" }).click();
  },
  resetHeading: page.getByRole("heading", { name: "Buat kata sandi baru" }),
  async setNewPassword(password: string): Promise<void> {
    await page.getByLabel("Kata sandi baru").fill(password);
    await page.getByRole("button", { name: "Simpan kata sandi baru" }).click();
  },
});

export type VerifyEmailPage = ReturnType<typeof createVerifyEmailPage>;
export type PasswordResetPages = ReturnType<typeof createPasswordResetPages>;
