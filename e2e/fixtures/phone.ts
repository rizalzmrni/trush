import { randomInt } from "node:crypto";

import { expect, request } from "@playwright/test";
import type { Page } from "@playwright/test";

import { TURNSTILE_DUMMY_TOKEN } from "./turnstile";
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

export interface BrowserApiResponse {
  readonly body: unknown;
  readonly status: number;
}

/**
 * `fetch` ke api dari halaman app, seperti klien browser (`VITE_API_URL`,
 * `credentials: "include"`): cookie sesi dan origin app ikut terkirim,
 * CORS api ikut diuji.
 */
export const browserApiFetch = (
  page: Page,
  path: string,
  {
    body,
    headers = {},
  }: { body?: unknown; headers?: Record<string, string> } = {}
): Promise<BrowserApiResponse> =>
  page.evaluate(
    async ({ apiUrl, init, url }) => {
      const response = await fetch(`${apiUrl}${url}`, {
        ...init,
        credentials: "include",
      });
      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Bukan JSON: kembalikan teks mentah.
      }
      return { body: parsed, status: response.status };
    },
    {
      apiUrl: API_URL,
      init:
        body === undefined
          ? { headers, method: "GET" }
          : {
              body: JSON.stringify(body),
              headers: { "content-type": "application/json", ...headers },
              method: "POST",
            },
      url: path,
    }
  );

/** `POST /api/auth/phone-number/send-otp` dengan token Turnstile dummy. */
export const requestPhoneOtp = (page: Page, phoneNumber: string) =>
  browserApiFetch(page, "/api/auth/phone-number/send-otp", {
    body: { phoneNumber },
    headers: { "x-captcha-response": TURNSTILE_DUMMY_TOKEN },
  });

/** `POST /api/auth/phone-number/verify` untuk menambah nomor ke akun login. */
export const verifyPhoneOtp = (page: Page, phoneNumber: string, code: string) =>
  browserApiFetch(page, "/api/auth/phone-number/verify", {
    body: { code, phoneNumber, updatePhoneNumber: true },
  });

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
