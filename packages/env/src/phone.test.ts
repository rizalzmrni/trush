import { describe, expect, it } from "vitest";

import { createApiEnv } from "./api";

// Semua nilai palsu.
const baseEnv = {
  APP_ENV: "development",
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:8787",
  CORS_ORIGINS: "http://localhost:5173",
  DATABASE_URL:
    "postgresql://user:password@ep-example-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
  PHONE_DRIVER: "memory",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
} as const;

const twilioVars = {
  TWILIO_ACCOUNT_SID: "ACtest",
  TWILIO_API_KEY_SECRET: "fake-secret-twilio",
  TWILIO_API_KEY_SID: "SKtest",
  TWILIO_MESSAGING_SERVICE_SID: "MGtest",
  TWILIO_WHATSAPP_OTP_CONTENT_SID: "HXtest",
} as const;

const productionEnv = {
  ...baseEnv,
  ...twilioVars,
  APP_ENV: "production",
  BETTER_AUTH_URL: "https://api.example.com",
  PHONE_DRIVER: "twilio",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAAfake-production-secret",
} as const;

const create = (overrides: Record<string, string | undefined>) =>
  createApiEnv({ runtimeEnv: { ...baseEnv, ...overrides } });

describe("env telepon di createApiEnv", () => {
  it("PHONE_ALLOWED_COUNTRIES default [ID], allowlist kosong", () => {
    const env = create({});

    expect(env.PHONE_ALLOWED_COUNTRIES).toStrictEqual(["ID"]);
    expect(env.PHONE_ALLOWLIST).toBeUndefined();
  });

  it("PHONE_DRIVER wajib", () => {
    expect(() => create({ PHONE_DRIVER: undefined })).toThrow(/PHONE_DRIVER/u);
  });

  it("PHONE_DRIVER di luar daftar ditolak", () => {
    expect(() => create({ PHONE_DRIVER: "twilio-verify" })).toThrow(
      /PHONE_DRIVER/u
    );
  });

  it("PHONE_ALLOWED_COUNTRIES dipisah koma, spasi diabaikan, urutan dipertahankan", () => {
    expect(
      create({ PHONE_ALLOWED_COUNTRIES: " MY, ID ,," }).PHONE_ALLOWED_COUNTRIES
    ).toStrictEqual(["MY", "ID"]);
  });

  it.each(["id", "IDN", "I1", " , "])(
    "PHONE_ALLOWED_COUNTRIES %j ditolak",
    (value) => {
      expect(() => create({ PHONE_ALLOWED_COUNTRIES: value })).toThrow(
        /PHONE_ALLOWED_COUNTRIES/u
      );
    }
  );

  it("PHONE_ALLOWLIST E.164 dipisah koma", () => {
    expect(
      create({ PHONE_ALLOWLIST: "+6281234567890, +6281299998888" })
        .PHONE_ALLOWLIST
    ).toStrictEqual(["+6281234567890", "+6281299998888"]);
  });

  it.each([
    "081299998888",
    "6281299998888",
    "+62 812 9999 8888",
    "+0812999988",
  ])(
    "PHONE_ALLOWLIST bukan E.164 %j ditolak tanpa membocorkan nilai",
    (value) => {
      const build = () => create({ PHONE_ALLOWLIST: value });

      expect(build).toThrow(/PHONE_ALLOWLIST/u);
      expect(build).toThrow(
        expect.objectContaining({ message: expect.not.stringContaining(value) })
      );
    }
  );

  it.each(["memory", "log", "twilio-test"])(
    "production + %s ditolak",
    (driver) => {
      expect(() =>
        createApiEnv({
          runtimeEnv: {
            ...productionEnv,
            PHONE_DRIVER: driver,
            TWILIO_TEST_ACCOUNT_SID: "ACsandbox",
            TWILIO_TEST_AUTH_TOKEN: "fake-token",
          },
        })
      ).toThrow(/PHONE_DRIVER wajib twilio/u);
    }
  );

  it("production + twilio lengkap diterima", () => {
    expect(createApiEnv({ runtimeEnv: productionEnv }).PHONE_DRIVER).toBe(
      "twilio"
    );
  });

  it.each(Object.keys(twilioVars))(
    "twilio tanpa %s ditolak dengan nama var, tanpa nilai secret",
    (name) => {
      const build = () =>
        createApiEnv({ runtimeEnv: { ...productionEnv, [name]: undefined } });

      expect(build).toThrow(new RegExp(name, "u"));
      expect(build).toThrow(
        expect.objectContaining({
          message: expect.not.stringContaining("fake-secret-twilio"),
        })
      );
    }
  );

  it.each(["TWILIO_TEST_ACCOUNT_SID", "TWILIO_TEST_AUTH_TOKEN"])(
    "twilio-test tanpa %s ditolak",
    (name) => {
      expect(() =>
        create({
          PHONE_DRIVER: "twilio-test",
          TWILIO_TEST_ACCOUNT_SID: "ACsandbox",
          TWILIO_TEST_AUTH_TOKEN: "fake-token",
          [name]: undefined,
        })
      ).toThrow(new RegExp(name, "u"));
    }
  );

  it("twilio-test lengkap diterima di development", () => {
    expect(
      create({
        PHONE_DRIVER: "twilio-test",
        TWILIO_TEST_ACCOUNT_SID: "ACsandbox",
        TWILIO_TEST_AUTH_TOKEN: "fake-token",
      }).PHONE_DRIVER
    ).toBe("twilio-test");
  });

  it("staging + twilio tanpa PHONE_ALLOWLIST ditolak", () => {
    expect(() =>
      create({ ...twilioVars, APP_ENV: "staging", PHONE_DRIVER: "twilio" })
    ).toThrow(/PHONE_ALLOWLIST/u);
  });

  it("staging + twilio dengan PHONE_ALLOWLIST diterima", () => {
    const env = create({
      ...twilioVars,
      APP_ENV: "staging",
      PHONE_ALLOWLIST: "+6281234567890",
      PHONE_DRIVER: "twilio",
    });

    expect(env.PHONE_ALLOWLIST).toStrictEqual(["+6281234567890"]);
  });

  it.each(["memory", "log"] as const)("development + %s diterima", (driver) => {
    expect(create({ PHONE_DRIVER: driver }).PHONE_DRIVER).toBe(driver);
  });

  // BUG: assertPhoneEnv mengizinkan PHONE_DRIVER=log saat staging; log hanya development.
  it.fails("staging + log ditolak", () => {
    expect(() => create({ APP_ENV: "staging", PHONE_DRIVER: "log" })).toThrow(
      /PHONE_DRIVER/u
    );
  });

  // BUG: assertPhoneEnv mengizinkan PHONE_DRIVER=memory saat staging (pengecualian E2E menyusul di B8).
  it.fails("staging + memory ditolak", () => {
    expect(() =>
      create({ APP_ENV: "staging", PHONE_DRIVER: "memory" })
    ).toThrow(/PHONE_DRIVER/u);
  });

  it("PHONE_ALLOWLIST string kosong dianggap tidak diisi", () => {
    expect(create({ PHONE_ALLOWLIST: "" }).PHONE_ALLOWLIST).toBeUndefined();
  });
});
