import { describe, expect, it } from "vitest";

import { rateLimitMessage, retryAfterSeconds } from "./retry-after.server";

const NOW = new Date("2026-11-02T10:00:00.000Z");
const SUBJECT = "Terlalu banyak permintaan kode.";

const limited = (headers: Record<string, string> = {}) =>
  new Response(null, { headers, status: 429 });

describe(retryAfterSeconds, () => {
  it("Retry-After (kuota OTP) didahulukan", () => {
    expect(
      retryAfterSeconds(limited({ "retry-after": "120", "x-retry-after": "5" }))
    ).toBe(120);
  });

  it("X-Retry-After (rate limit IP) dipakai bila Retry-After tidak ada", () => {
    expect(retryAfterSeconds(limited({ "x-retry-after": " 30 " }))).toBe(30);
  });

  it.each(["0", "-5", "1.5", "abc", "Wed, 21 Oct 2026 07:28:00 GMT", ""])(
    "Retry-After %j tidak valid tidak menutupi X-Retry-After",
    (value) => {
      expect(
        retryAfterSeconds(
          limited({ "retry-after": value, "x-retry-after": "9" })
        )
      ).toBe(9);
    }
  );

  it("tanpa header valid → undefined", () => {
    expect(
      retryAfterSeconds(limited({ "retry-after": "nanti" }))
    ).toBeUndefined();
  });
});

describe(rateLimitMessage, () => {
  it("dengan header → waktu tunggu relatif", () => {
    expect(
      rateLimitMessage(limited({ "retry-after": "720" }), SUBJECT, NOW)
    ).toMatch(/^Terlalu banyak permintaan kode\. Coba lagi .*12 menit.*\.$/u);
  });

  it("tanpa header → tunggu sebentar", () => {
    expect(rateLimitMessage(limited(), SUBJECT, NOW)).toBe(
      "Terlalu banyak permintaan kode. Tunggu sebentar lalu coba lagi."
    );
  });
});
