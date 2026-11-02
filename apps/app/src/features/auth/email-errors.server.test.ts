import { describe, expect, it } from "vitest";

import { jsonResponse } from "../../testing/cloudflare";
import { emailAuthError } from "./email-errors.server";

const SUBJECT = "Terlalu banyak percobaan kode.";
const FALLBACK = "Terjadi kesalahan. Coba lagi beberapa saat lagi.";

const failed = (status: number, body: unknown, headers?: HeadersInit) =>
  jsonResponse(body, { headers, status });

describe(emailAuthError, () => {
  it.each([
    ["EMAIL_NOT_VERIFIED", 403, /^Email belum diverifikasi/u],
    ["INVALID_OTP", 400, /^Kode salah/u],
    ["OTP_EXPIRED", 400, /^Kode sudah kedaluwarsa/u],
    ["TOO_MANY_ATTEMPTS", 403, /^Terlalu banyak kode salah/u],
    ["INVALID_TOKEN", 400, /^Tautan reset kata sandi tidak berlaku/u],
  ] as const)("%s → kode + pesan Indonesia", async (code, status, message) => {
    const error = await emailAuthError(
      failed(status, { code, message: "internal" }),
      SUBJECT
    );

    expect(error.code).toBe(code);
    expect(error.message).toMatch(message);
  });

  it("kode umum auth (mis. PASSWORD_COMPROMISED) memakai pesan auth bersama", async () => {
    const error = await emailAuthError(
      failed(400, { code: "PASSWORD_COMPROMISED" }),
      SUBJECT
    );

    expect(error.message).not.toBe(FALLBACK);
  });

  it("429 → pesan kuota dengan subjek, kode tetap terbaca", async () => {
    const error = await emailAuthError(
      failed(429, { code: "OTP_RATE_LIMITED" }, { "retry-after": "60" }),
      SUBJECT,
      new Date("2026-11-02T10:00:00.000Z")
    );

    expect(error.code).toBe("OTP_RATE_LIMITED");
    expect(error.message.startsWith(SUBJECT)).toBeTruthy();
  });

  it.each([
    ["kode tak dikenal", failed(400, { code: "RAHASIA_INTERNAL" })],
    ["tanpa kode", failed(500, {})],
    ["bukan JSON", new Response("<html>", { status: 502 })],
  ])(
    "%s → pesan cadangan (pesan api tidak diteruskan)",
    async (_label, response) => {
      const error = await emailAuthError(response, SUBJECT);

      expect(error.message).toBe(FALLBACK);
    }
  );
});
