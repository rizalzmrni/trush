import { describe, expect, it } from "vitest";

import { createApiEnv } from "./api";

// Semua nilai palsu.
const FAKE_RESEND_KEY = "re_fake-secret-resend-0123456789";

const developmentEnv = {
  APP_ENV: "development",
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:8787",
  CORS_ORIGINS: "http://localhost:5173",
  APP_URL: "http://localhost:5173",
  DATABASE_URL:
    "postgresql://user:password@ep-example-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
  PHONE_DRIVER: "memory",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
} as const;

const resendVars = {
  EMAIL_DRIVER: "resend",
  EMAIL_FROM: "trush <noreply@example.com>",
  RESEND_API_KEY: FAKE_RESEND_KEY,
} as const;

const stagingEnv = {
  ...developmentEnv,
  ...resendVars,
  APP_ENV: "staging",
  EMAIL_ALLOWLIST: "@example.com",
  PHONE_DRIVER: "twilio-test",
  TWILIO_TEST_ACCOUNT_SID: "ACtest",
  TWILIO_TEST_AUTH_TOKEN: "fake-test-token",
} as const;

const productionEnv = {
  ...developmentEnv,
  ...resendVars,
  APP_ENV: "production",
  BETTER_AUTH_URL: "https://api.example.com",
  PHONE_DRIVER: "twilio",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAAfake-production-secret",
  TWILIO_ACCOUNT_SID: "ACtest",
  TWILIO_API_KEY_SECRET: "fake-secret-twilio",
  TWILIO_API_KEY_SID: "SKtest",
  TWILIO_MESSAGING_SERVICE_SID: "MGtest",
  TWILIO_WHATSAPP_OTP_CONTENT_SID: "HXtest",
} as const;

type Overrides = Record<string, string | undefined>;

const build = (base: Overrides, overrides: Overrides = {}) =>
  createApiEnv({ runtimeEnv: { ...base, ...overrides } });

const notLeaking = (value: string) =>
  expect.objectContaining({ message: expect.not.stringContaining(value) });

describe("env email: driver per lingkungan", () => {
  it("development tanpa EMAIL_DRIVER memakai default log", () => {
    const env = build(developmentEnv);

    expect(env.EMAIL_DRIVER).toBe("log");
    expect(env.EMAIL_FROM).toBeUndefined();
    expect(env.EMAIL_ALLOWLIST).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it.each(["log", "memory"])("development + %s diterima", (driver) => {
    expect(build(developmentEnv, { EMAIL_DRIVER: driver }).EMAIL_DRIVER).toBe(
      driver
    );
  });

  it("development + resend lengkap tanpa allowlist diterima", () => {
    expect(build(developmentEnv, resendVars).EMAIL_DRIVER).toBe("resend");
  });

  it.each(["smtp", "Resend", "sendgrid"])(
    "EMAIL_DRIVER %s di luar daftar ditolak",
    (driver) => {
      expect(() => build(developmentEnv, { EMAIL_DRIVER: driver })).toThrow(
        /EMAIL_DRIVER/u
      );
    }
  );

  it("production + resend lengkap diterima; allowlist opsional", () => {
    const env = build(productionEnv);

    expect(env.EMAIL_DRIVER).toBe("resend");
    expect(env.EMAIL_ALLOWLIST).toBeUndefined();
  });

  it.each(["log", "memory", undefined])(
    "production + EMAIL_DRIVER %s ditolak (wajib resend)",
    (driver) => {
      expect(() => build(productionEnv, { EMAIL_DRIVER: driver })).toThrow(
        /EMAIL_DRIVER wajib resend/u
      );
    }
  );

  it("staging + resend dengan allowlist diterima", () => {
    const env = build(stagingEnv);

    expect(env.EMAIL_DRIVER).toBe("resend");
    expect(env.EMAIL_ALLOWLIST).toStrictEqual(["@example.com"]);
  });

  it.each(["log", "memory", undefined])(
    "staging + EMAIL_DRIVER %s ditolak",
    (driver) => {
      expect(() => build(stagingEnv, { EMAIL_DRIVER: driver })).toThrow(
        /EMAIL_DRIVER=(?:log|memory) hanya sah saat APP_ENV=development/u
      );
    }
  );

  it.each([undefined, "", " , "])(
    "staging + resend dengan EMAIL_ALLOWLIST %j ditolak",
    (allowlist) => {
      expect(() => build(stagingEnv, { EMAIL_ALLOWLIST: allowlist })).toThrow(
        /EMAIL_ALLOWLIST/u
      );
    }
  );
});

describe("env email: kredensial resend", () => {
  it.each(["EMAIL_FROM", "RESEND_API_KEY"])(
    "resend tanpa %s ditolak dengan nama var, tanpa nilai secret",
    (name) => {
      const create = () => build(productionEnv, { [name]: undefined });

      expect(create).toThrow(
        new RegExp(`EMAIL_DRIVER=resend butuh: ${name}`, "u")
      );
      expect(create).toThrow(notLeaking(FAKE_RESEND_KEY));
    }
  );

  it("resend tanpa keduanya menyebut kedua nama var", () => {
    expect(() => build(developmentEnv, { EMAIL_DRIVER: "resend" })).toThrow(
      /EMAIL_FROM, RESEND_API_KEY/u
    );
  });

  it("RESEND_API_KEY string kosong dianggap tidak diisi", () => {
    expect(() => build(productionEnv, { RESEND_API_KEY: "" })).toThrow(
      /RESEND_API_KEY/u
    );
  });

  it("error validasi var lain tidak membocorkan RESEND_API_KEY", () => {
    expect(() => build(productionEnv, { EMAIL_FROM: "bukan-alamat" })).toThrow(
      /EMAIL_FROM/u
    );
    expect(() => build(productionEnv, { EMAIL_FROM: "bukan-alamat" })).toThrow(
      notLeaking(FAKE_RESEND_KEY)
    );
  });
});

describe("env email: format EMAIL_FROM", () => {
  it.each([
    "noreply@example.com",
    "trush <noreply@example.com>",
    "trush staging <noreply@mail.example.co.id>",
  ])("%s diterima", (from) => {
    expect(build(productionEnv, { EMAIL_FROM: from }).EMAIL_FROM).toBe(from);
  });

  it("spasi di tepi dipangkas", () => {
    expect(
      build(productionEnv, { EMAIL_FROM: "  noreply@example.com  " }).EMAIL_FROM
    ).toBe("noreply@example.com");
  });

  it.each([
    "trush",
    "noreply@",
    "noreply@example",
    "no reply@example.com",
    "<noreply@example.com>",
    "trush <noreply@example.com",
    "trush noreply@example.com",
  ])("%s ditolak", (from) => {
    const create = () => build(productionEnv, { EMAIL_FROM: from });

    expect(create).toThrow(/EMAIL_FROM/u);
  });
});

describe("env email: format EMAIL_ALLOWLIST", () => {
  it("alamat dan @domain dipisah koma, spasi dibuang, huruf kecil", () => {
    const env = build(stagingEnv, {
      EMAIL_ALLOWLIST: " Tim@Example.com , @Example.CO.ID ,, qa@example.com ",
    });

    expect(env.EMAIL_ALLOWLIST).toStrictEqual([
      "tim@example.com",
      "@example.co.id",
      "qa@example.com",
    ]);
  });

  it.each(["example.com", "@localhost", "tim@", "@example", "@exa mple.com"])(
    "entri %s ditolak",
    (entry) => {
      expect(() => build(stagingEnv, { EMAIL_ALLOWLIST: entry })).toThrow(
        /EMAIL_ALLOWLIST/u
      );
    }
  );

  it("satu entri tidak valid menolak seluruh daftar", () => {
    expect(() =>
      build(stagingEnv, { EMAIL_ALLOWLIST: "@example.com,bukan-entri" })
    ).toThrow(/EMAIL_ALLOWLIST/u);
  });

  it("allowlist string kosong di development dianggap tidak diisi", () => {
    expect(
      build(developmentEnv, { EMAIL_ALLOWLIST: "" }).EMAIL_ALLOWLIST
    ).toBeUndefined();
  });
});

describe("env email: E2E=true", () => {
  it("E2E=true + EMAIL_DRIVER=memory diterima", () => {
    const env = build(developmentEnv, { E2E: "true", EMAIL_DRIVER: "memory" });

    expect(env.E2E).toBeTruthy();
    expect(env.EMAIL_DRIVER).toBe("memory");
  });

  it.each(["log", "resend", undefined])(
    "E2E=true + EMAIL_DRIVER %s ditolak",
    (driver) => {
      expect(() =>
        build(developmentEnv, {
          ...resendVars,
          E2E: "true",
          EMAIL_DRIVER: driver,
        })
      ).toThrow(/E2E=true mewajibkan EMAIL_DRIVER=memory/u);
    }
  );
});
