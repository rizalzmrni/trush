import { describe, expect, it } from "vitest";
import { z } from "zod";

import { errorResponseSchema } from "./error";

describe("skema ErrorResponse", () => {
  it("menerima error dengan dan tanpa details", () => {
    const minimal = { error: { code: "NOT_FOUND", message: "Tidak ada." } };
    const withDetails = {
      error: {
        code: "VALIDATION_ERROR",
        details: [{ path: ["email"] }],
        message: "Request tidak valid.",
      },
    };

    expect(errorResponseSchema.parse(minimal)).toStrictEqual(minimal);
    expect(errorResponseSchema.parse(withDetails)).toStrictEqual(withDetails);
  });

  it.each([
    ["code kosong", { error: { code: "", message: "m" } }],
    ["code hilang", { error: { message: "m" } }],
    ["message hilang", { error: { code: "X" } }],
    ["code bukan string", { error: { code: 500, message: "m" } }],
    ["tanpa pembungkus error", { code: "X", message: "m" }],
    ["error null", { error: null }],
  ])("menolak %s", (_label, input) => {
    expect(errorResponseSchema.safeParse(input).success).toBeFalsy();
  });

  it("membuang field tak dikenal seperti stack", () => {
    const parsed = errorResponseSchema.parse({
      error: { code: "INTERNAL", message: "Gagal.", stack: "at x" },
      extra: true,
    });

    expect(parsed).toStrictEqual({
      error: { code: "INTERNAL", message: "Gagal." },
    });
  });

  it("terdaftar di registry global dengan id ErrorResponse", () => {
    expect(z.globalRegistry.get(errorResponseSchema)).toMatchObject({
      id: "ErrorResponse",
    });
  });
});
