import { describe, expect, it } from "vitest";

import { createApiEnv } from "./api";

const validEnv = {
  APP_ENV: "staging",
  CORS_ORIGINS: "https://app.example.test",
  DATABASE_URL:
    "postgresql://user:password@ep-example-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:8787",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  PHONE_DRIVER: "memory",
} as const;

const productionEnv = {
  ...validEnv,
  APP_ENV: "production",
  BETTER_AUTH_URL: "https://api.example.com",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAAfake-production-secret",
  PHONE_DRIVER: "twilio",
  TWILIO_ACCOUNT_SID: "ACtest",
  TWILIO_API_KEY_SID: "SKtest",
  TWILIO_API_KEY_SECRET: "fake-secret",
  TWILIO_MESSAGING_SERVICE_SID: "MGtest",
  TWILIO_WHATSAPP_OTP_CONTENT_SID: "HXtest",
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

  it.each([
    "APP_ENV",
    "CORS_ORIGINS",
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "TURNSTILE_SECRET_KEY",
  ] as const)("menolak bila %s hilang", (name) => {
    const { [name]: _omitted, ...rest } = validEnv;

    expect(() => createApiEnv({ runtimeEnv: rest })).toThrow(
      new RegExp(`Env tidak valid: .*${name}`, "u")
    );
  });

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

  it("BetterStack opsional: tanpa keduanya valid", () => {
    const env = createApiEnv({ runtimeEnv: validEnv });

    expect(env.BETTERSTACK_INGEST_URL).toBeUndefined();
    expect(env.BETTERSTACK_SOURCE_TOKEN).toBeUndefined();
  });

  it("BetterStack diisi bersama diterima", () => {
    const env = createApiEnv({
      runtimeEnv: {
        ...validEnv,
        BETTERSTACK_INGEST_URL: "https://ingest.example.test",
        BETTERSTACK_SOURCE_TOKEN: "fake-source-token",
      },
    });

    expect(env.BETTERSTACK_INGEST_URL).toBe("https://ingest.example.test");
    expect(env.BETTERSTACK_SOURCE_TOKEN).toBe("fake-source-token");
  });

  it.each([
    ["hanya URL", { BETTERSTACK_INGEST_URL: "https://ingest.example.test" }],
    ["hanya token", { BETTERSTACK_SOURCE_TOKEN: "fake-source-token" }],
    [
      "token string kosong",
      {
        BETTERSTACK_INGEST_URL: "https://ingest.example.test",
        BETTERSTACK_SOURCE_TOKEN: "",
      },
    ],
  ])("BetterStack %s ditolak tanpa membocorkan token", (_label, partial) => {
    const create = () =>
      createApiEnv({ runtimeEnv: { ...validEnv, ...partial } });

    expect(create).toThrow(/BETTERSTACK_INGEST_URL.*BETTERSTACK_SOURCE_TOKEN/u);
    expect(create).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("fake-source-token"),
      })
    );
  });

  it("BETTERSTACK_INGEST_URL bukan URL ditolak", () => {
    expect(() =>
      createApiEnv({
        runtimeEnv: {
          ...validEnv,
          BETTERSTACK_INGEST_URL: "bukan-url",
          BETTERSTACK_SOURCE_TOKEN: "fake-source-token",
        },
      })
    ).toThrow(/BETTERSTACK_INGEST_URL/u);
  });

  it("var auth B6 terbaca; AUTH_COOKIE_DOMAIN opsional", () => {
    const env = createApiEnv({ runtimeEnv: validEnv });

    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:8787");
    expect(env.AUTH_COOKIE_DOMAIN).toBeUndefined();
  });

  it("AUTH_COOKIE_DOMAIN string kosong dianggap tidak diisi", () => {
    const env = createApiEnv({
      runtimeEnv: { ...validEnv, AUTH_COOKIE_DOMAIN: "" },
    });

    expect(env.AUTH_COOKIE_DOMAIN).toBeUndefined();
  });

  it.each(["example.com", ".example.com", "auth.example.co.id"])(
    "AUTH_COOKIE_DOMAIN %s diterima",
    (domain) => {
      const env = createApiEnv({
        runtimeEnv: { ...validEnv, AUTH_COOKIE_DOMAIN: domain },
      });

      expect(env.AUTH_COOKIE_DOMAIN).toBe(domain);
    }
  );

  it.each([
    "https://example.com",
    "example.com:8787",
    "localhost",
    "Example.com",
    "example.com/path",
  ])("AUTH_COOKIE_DOMAIN %s ditolak", (domain) => {
    expect(() =>
      createApiEnv({ runtimeEnv: { ...validEnv, AUTH_COOKIE_DOMAIN: domain } })
    ).toThrow(/AUTH_COOKIE_DOMAIN/u);
  });

  it.each([
    "mysql://user:password@db.example.test/neondb",
    "https://db.example.test",
    "bukan-url",
  ])("DATABASE_URL %s ditolak", (url) => {
    expect(() =>
      createApiEnv({ runtimeEnv: { ...validEnv, DATABASE_URL: url } })
    ).toThrow(/DATABASE_URL/u);
  });

  it("BETTER_AUTH_SECRET kurang dari 32 karakter ditolak tanpa membocorkan nilai", () => {
    const shortSecret = "pendek-palsu-0123456789abcdef01";
    const create = () =>
      createApiEnv({
        runtimeEnv: { ...validEnv, BETTER_AUTH_SECRET: shortSecret },
      });

    expect(shortSecret).toHaveLength(31);
    expect(create).toThrow(/BETTER_AUTH_SECRET/u);
    expect(create).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(shortSecret),
      })
    );
  });

  it("BETTER_AUTH_SECRET tepat 32 karakter diterima", () => {
    const secret = "a".repeat(32);
    const env = createApiEnv({
      runtimeEnv: { ...validEnv, BETTER_AUTH_SECRET: secret },
    });

    expect(env.BETTER_AUTH_SECRET).toBe(secret);
  });

  it("BETTER_AUTH_URL bukan URL ditolak", () => {
    expect(() =>
      createApiEnv({
        runtimeEnv: { ...validEnv, BETTER_AUTH_URL: "bukan-url" },
      })
    ).toThrow(/BETTER_AUTH_URL/u);
  });

  it("production dengan nilai aman diterima", () => {
    const env = createApiEnv({ runtimeEnv: productionEnv });

    expect(env.APP_ENV).toBe("production");
  });

  it.each([
    "1x0000000000000000000000000000000AA",
    "2x0000000000000000000000000000000AA",
    "3x0000000000000000000000000000000AA",
  ])("production menolak kunci uji Turnstile %s", (key) => {
    const create = () =>
      createApiEnv({
        runtimeEnv: { ...productionEnv, TURNSTILE_SECRET_KEY: key },
      });

    expect(create).toThrow(/TURNSTILE_SECRET_KEY/u);
    expect(create).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(key) })
    );
  });

  it.each(["development", "staging"])(
    "%s menerima kunci uji Turnstile dan BETTER_AUTH_URL http",
    (appEnv) => {
      const env = createApiEnv({
        runtimeEnv: { ...validEnv, APP_ENV: appEnv },
      });

      expect(env.TURNSTILE_SECRET_KEY).toBe(validEnv.TURNSTILE_SECRET_KEY);
    }
  );

  it("production menolak BETTER_AUTH_URL http", () => {
    expect(() =>
      createApiEnv({
        runtimeEnv: {
          ...productionEnv,
          BETTER_AUTH_URL: "http://api.example.com",
        },
      })
    ).toThrow(/BETTER_AUTH_URL.*https/u);
  });
});
