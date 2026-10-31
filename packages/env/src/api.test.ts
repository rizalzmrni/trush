import { describe, expect, it } from "vitest";

import { createApiEnv } from "./api";

const validEnv = {
  APP_ENV: "staging",
  CORS_ORIGINS: "https://app.example.test",
} as const;

describe(createApiEnv, () => {
  it("parse env valid dan memakai default", () => {
    const env = createApiEnv({ runtimeEnv: validEnv });

    expect(env.APP_ENV).toBe("staging");
    expect(env.API_DOCS_ENABLED).toBeTypeOf("boolean");
    expect(env.API_DOCS_ENABLED).toBeFalsy();
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("memisah CORS_ORIGINS dipisah koma menjadi array URL", () => {
    const env = createApiEnv({
      runtimeEnv: {
        ...validEnv,
        CORS_ORIGINS: "http://localhost:5173, http://localhost:5174,",
      },
    });

    expect(env.CORS_ORIGINS).toStrictEqual([
      "http://localhost:5173",
      "http://localhost:5174",
    ]);
  });

  it("menolak CORS_ORIGINS yang memuat bukan-URL", () => {
    expect(() =>
      createApiEnv({
        runtimeEnv: { ...validEnv, CORS_ORIGINS: "https://ok.test,bukan-url" },
      })
    ).toThrow(/CORS_ORIGINS/u);
  });

  it("menolak CORS_ORIGINS tanpa origin", () => {
    expect(() =>
      createApiEnv({ runtimeEnv: { ...validEnv, CORS_ORIGINS: " , " } })
    ).toThrow(/CORS_ORIGINS/u);
  });

  it.each([
    [true, true],
    [false, false],
    ["true", true],
    ["false", false],
  ])("API_DOCS_ENABLED %j dibaca sebagai %j", (input, expected) => {
    const env = createApiEnv({
      runtimeEnv: { ...validEnv, API_DOCS_ENABLED: input },
    });

    expect(env.API_DOCS_ENABLED).toBe(expected);
  });

  it("string kosong diperlakukan sebagai tidak diisi", () => {
    const env = createApiEnv({
      runtimeEnv: { ...validEnv, API_DOCS_ENABLED: "", LOG_LEVEL: "" },
    });

    expect(env.API_DOCS_ENABLED).toBeTypeOf("boolean");
    expect(env.API_DOCS_ENABLED).toBeFalsy();
    expect(env.LOG_LEVEL).toBe("info");
  });

  it.each(["APP_ENV", "CORS_ORIGINS"] as const)(
    "menolak bila %s hilang",
    (name) => {
      const { [name]: _omitted, ...rest } = validEnv;

      expect(() => createApiEnv({ runtimeEnv: rest })).toThrow(
        new RegExp(`Env tidak valid: .*${name}`, "u")
      );
    }
  );

  it("menolak APP_ENV di luar daftar", () => {
    expect(() =>
      createApiEnv({ runtimeEnv: { ...validEnv, APP_ENV: "prod" } })
    ).toThrow(/APP_ENV/u);
  });

  it("menolak LOG_LEVEL dan API_DOCS_ENABLED yang salah", () => {
    expect(() =>
      createApiEnv({ runtimeEnv: { ...validEnv, LOG_LEVEL: "verbose" } })
    ).toThrow(/LOG_LEVEL/u);
    expect(() =>
      createApiEnv({ runtimeEnv: { ...validEnv, API_DOCS_ENABLED: "maybe" } })
    ).toThrow(/API_DOCS_ENABLED/u);
  });

  it("pesan error memuat nama var, tidak memuat nilainya", () => {
    const fakeValue = "s3cr3t-nilai-palsu-123";
    const create = () =>
      createApiEnv({
        runtimeEnv: {
          ...validEnv,
          API_DOCS_ENABLED: fakeValue,
          APP_ENV: fakeValue,
          CORS_ORIGINS: fakeValue,
          LOG_LEVEL: fakeValue,
        },
      });

    expect(create).toThrow(
      /APP_ENV.*API_DOCS_ENABLED.*CORS_ORIGINS.*LOG_LEVEL/u
    );
    expect(create).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(fakeValue),
      })
    );
  });

  it("binding non-primitif disaring dari runtimeEnv", () => {
    const env = createApiEnv({
      runtimeEnv: { ...validEnv, BUCKET: { get: () => null } },
    });

    expect(env).not.toHaveProperty("BUCKET");
  });

  it("binding objek tidak bisa mengisi var wajib", () => {
    expect(() =>
      createApiEnv({
        runtimeEnv: {
          ...validEnv,
          CORS_ORIGINS: { toString: () => "https://ok.test" },
        },
      })
    ).toThrow(/CORS_ORIGINS/u);
  });
});
