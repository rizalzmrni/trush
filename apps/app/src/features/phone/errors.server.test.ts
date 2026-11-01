import { describe, expect, it } from "vitest";

import { phoneErrorMessage, retryAfterSeconds } from "./errors.server";

const tooMany = (headers: HeadersInit): Response =>
  new Response(null, { headers, status: 429 });

describe(retryAfterSeconds, () => {
  it("membaca Retry-After (kuota OTP)", () => {
    expect(retryAfterSeconds(tooMany({ "retry-after": "720" }))).toBe(720);
  });

  it("membaca X-Retry-After (rate limit IP better-auth)", () => {
    expect(retryAfterSeconds(tooMany({ "x-retry-after": "45" }))).toBe(45);
  });

  it("Retry-After didahulukan bila keduanya ada", () => {
    expect(
      retryAfterSeconds(tooMany({ "retry-after": "60", "x-retry-after": "5" }))
    ).toBe(60);
  });

  it("spasi di sekitar angka diabaikan", () => {
    expect(retryAfterSeconds(tooMany({ "retry-after": " 30 " }))).toBe(30);
  });

  it("tanpa header → undefined", () => {
    expect(retryAfterSeconds(tooMany({}))).toBeUndefined();
  });

  it.each([
    ["nol", "0"],
    ["negatif", "-5"],
    ["pecahan", "12.5"],
    ["HTTP-date", "Wed, 21 Oct 2026 07:28:00 GMT"],
    ["teks", "sebentar"],
    ["kosong", ""],
    ["eksponen", "1e3"],
  ])("nilai %s → undefined", (_label, value) => {
    expect(
      retryAfterSeconds(tooMany({ "retry-after": value }))
    ).toBeUndefined();
  });
});

const NOW = new Date("2026-11-01T09:00:00.000Z");

const invalid = (): Response =>
  Response.json({ code: "INVALID_OTP" }, { status: 400 });

describe(phoneErrorMessage, () => {
  it.each([
    ["send", "permintaan"],
    ["verify", "percobaan"],
  ] as const)(
    "429 %s dengan Retry-After → waktu relatif dari now",
    async (kind, subject) => {
      await expect(
        phoneErrorMessage(tooMany({ "retry-after": "720" }), kind, NOW)
      ).resolves.toBe(
        `Terlalu banyak ${subject} kode. Coba lagi dalam 12 menit.`
      );
    }
  );

  it.each([
    ["send", "permintaan"],
    ["verify", "percobaan"],
  ] as const)(
    "429 %s dengan X-Retry-After → waktu relatif",
    async (kind, subject) => {
      await expect(
        phoneErrorMessage(tooMany({ "x-retry-after": "45" }), kind, NOW)
      ).resolves.toBe(
        `Terlalu banyak ${subject} kode. Coba lagi dalam 45 detik.`
      );
    }
  );

  it.each([
    ["send", "permintaan"],
    ["verify", "percobaan"],
  ] as const)(
    "429 %s tanpa header → pesan tunggu umum",
    async (kind, subject) => {
      await expect(phoneErrorMessage(tooMany({}), kind, NOW)).resolves.toBe(
        `Terlalu banyak ${subject} kode. Tunggu sebentar lalu coba lagi.`
      );
    }
  );

  it("kind default send", async () => {
    await expect(phoneErrorMessage(tooMany({}))).resolves.toBe(
      "Terlalu banyak permintaan kode. Tunggu sebentar lalu coba lagi."
    );
  });

  it("kind tidak memengaruhi error non-429", async () => {
    const send = await phoneErrorMessage(invalid(), "send", NOW);
    const verify = await phoneErrorMessage(invalid(), "verify", NOW);

    expect(verify).toBe("Kode salah. Periksa lagi lalu coba kembali.");
    expect(send).toBe(verify);
  });
});
