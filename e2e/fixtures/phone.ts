import { randomInt } from "node:crypto";

import { expect, request } from "@playwright/test";
import type { Page } from "@playwright/test";

import { expectCaptchaReady } from "./auth-pages";
import { API_URL } from "./urls";

const NATIONAL_SUFFIX_DIGITS = 8;
const OTP_CODE = /^\d{4,8}$/u;
const NATIONAL_SUFFIX_MAX = 10 ** NATIONAL_SUFFIX_DIGITS;

/**
 * Nomor seluler Indonesia acak berformat E.164 (`+62812xxxxxxxx`), unik per
 * test. Driver `memory` tidak pernah mengirim ke penyedia.
 */
export const uniquePhoneNumber = (): string =>
  `+62812${String(randomInt(NATIONAL_SUFFIX_MAX)).padStart(NATIONAL_SUFFIX_DIGITS, "0")}`;

/** `+62812…` → `0812…`: format lokal yang diketik pengguna Indonesia. */
export const toLocalFormat = (e164: string): string =>
  e164.replace(/^\+62/u, "0");

/** Halaman `/settings/phone` `apps/app` (tambah/ganti + verifikasi nomor). */
export const createPhoneSettingsPage = (page: Page) => {
  const heading = page.getByRole("heading", {
    level: 1,
    name: "Nomor telepon",
  });
  const verifyHeading = page.getByRole("heading", {
    name: "Masukkan kode verifikasi",
  });
  return {
    /** Nomor tersimpan di akun tampil dengan status terverifikasi. */
    async expectVerified(e164: string): Promise<void> {
      await expect(page.getByText(e164, { exact: true })).toBeVisible();
      await expect(
        page.getByText("Terverifikasi", { exact: true })
      ).toBeVisible();
    },
    async expectNoPhone(): Promise<void> {
      await expect(page.getByText("Belum ada nomor telepon")).toBeVisible();
    },
    formError: page.getByRole("alert"),
    async goto(): Promise<void> {
      await page.goto("/settings/phone");
      await expect(heading).toBeVisible();
    },
    heading,
    /** Info sukses (`role="status"`): kode terkirim / nomor tersimpan. */
    notice: page.getByRole("status"),
    async resendViaSms(): Promise<void> {
      await expectCaptchaReady(page);
      await page.getByRole("button", { name: "Kirim ulang lewat SMS" }).click();
    },
    /** Langkah 1: isi nomor, pilih kanal, kirim kode → langkah verifikasi. */
    async sendCode(phoneNumber: string, channel = "WhatsApp"): Promise<void> {
      await expectCaptchaReady(page);
      await page.getByLabel(/^Nomor telepon/u).fill(phoneNumber);
      await page.getByRole("radio", { name: channel }).check();
      await page
        .getByRole("button", { exact: true, name: "Kirim kode" })
        .click();
      await expect(verifyHeading).toBeVisible();
    },
    /** Langkah 2: masukkan kode lalu verifikasi. */
    async submitCode(code: string): Promise<void> {
      await page.getByLabel("Kode verifikasi").fill(code);
      await page.getByRole("button", { name: "Verifikasi nomor" }).click();
    },
    verifyHeading,
  };
};

export type PhoneSettingsPage = ReturnType<typeof createPhoneSettingsPage>;

/** Bagian kontrak `E2eOutboxMessage` (`@trush/core/schemas/e2e`) yang dipakai. */
interface OutboxMessage {
  readonly code: string | null;
  readonly to: string;
}

const isOutboxMessage = (value: unknown): value is OutboxMessage =>
  typeof value === "object" &&
  value !== null &&
  "to" in value &&
  typeof value.to === "string" &&
  "code" in value &&
  (typeof value.code === "string" || value.code === null);

/** `messages` dari body `E2eOutboxResponse` (terbaru dulu). */
const outboxMessages = (body: unknown): OutboxMessage[] => {
  const list =
    typeof body === "object" && body !== null && "messages" in body
      ? body.messages
      : undefined;
  return Array.isArray(list) ? list.filter(isOutboxMessage) : [];
};

/**
 * Kode OTP terbaru untuk `phoneNumber` dari `GET /__e2e/outbox?to=…` (driver
 * `memory`, hanya aktif saat `E2E=true`). Outbox milik isolate api dan dibagi
 * semua test paralel, jadi selalu disaring per nomor unik. Di-poll lewat
 * `expect.poll` karena tidak ada event "pesan terkirim" yang bisa ditunggu.
 */
export const readOtpFromOutbox = async (
  phoneNumber: string
): Promise<string> => {
  const api = await request.newContext({ baseURL: API_URL });
  try {
    let code: string | null | undefined;
    await expect
      .poll(async () => {
        const response = await api.get("/__e2e/outbox", {
          params: { to: phoneNumber },
        });
        expect(response.status()).toBe(200);
        const [latest] = outboxMessages(await response.json());
        code = latest?.to === phoneNumber ? latest.code : undefined;
        return code;
      })
      .toMatch(OTP_CODE);
    return code ?? "";
  } finally {
    await api.dispose();
  }
};
