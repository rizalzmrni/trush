import { describe, expect, it } from "vitest";

import { assertSameAppEnv, throwEnvError, toRuntimeEnv } from "./shared";

describe(toRuntimeEnv, () => {
  it("hanya meneruskan nilai primitif", () => {
    const result = toRuntimeEnv({
      BOOL: false,
      BUCKET: { put: () => null },
      FN: () => "x",
      LIST: ["a"],
      MISSING: undefined,
      NIL: null,
      NUM: 0,
      STR: "",
    });

    expect(result).toStrictEqual({ BOOL: false, NUM: 0, STR: "" });
  });
});

describe(throwEnvError, () => {
  it("pesan memuat path dan alasan setiap issue", () => {
    expect(() =>
      throwEnvError([
        { message: "Required", path: ["APP_ENV"] },
        { message: "Invalid URL", path: [{ key: "CORS_ORIGINS" }, 0] },
        { message: "Bad" },
      ])
    ).toThrow(
      "Env tidak valid: APP_ENV: Required; CORS_ORIGINS.0: Invalid URL; (root): Bad"
    );
  });
});

describe(assertSameAppEnv, () => {
  it("lolos bila sama", () => {
    expect(() => assertSameAppEnv("staging", "staging")).not.toThrow();
  });

  it("melempar bila berbeda", () => {
    expect(() => assertSameAppEnv("production", "development")).toThrow(
      /VITE_APP_ENV/u
    );
  });
});
