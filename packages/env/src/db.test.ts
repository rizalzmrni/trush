import { describe, expect, it } from "vitest";

import {
  createDbToolingEnv,
  databaseUrlSchema,
  unpooledDatabaseUrlSchema,
} from "./db";

// Kredensial palsu; tidak menunjuk ke database nyata.
const FAKE_PASSWORD = "s3cr3t-palsu-xyz";
const DIRECT_URL = `postgresql://trush:${FAKE_PASSWORD}@ep-fake-123.ap-southeast-1.aws.neon.tech/trush?sslmode=require`;
const POOLED_URL = `postgresql://trush:${FAKE_PASSWORD}@ep-fake-123-pooler.ap-southeast-1.aws.neon.tech/trush?sslmode=require`;

const captureError = (run: () => unknown): Error => {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }
    throw new Error("yang dilempar bukan Error", { cause: error });
  }
  throw new Error("diharapkan melempar");
};

describe(createDbToolingEnv, () => {
  it("menerima URL direct postgresql://", () => {
    const env = createDbToolingEnv({
      requireConnection: true,
      runtimeEnv: { DATABASE_URL_UNPOOLED: DIRECT_URL },
    });

    expect(env.DATABASE_URL_UNPOOLED).toBe(DIRECT_URL);
  });

  it("menerima protokol postgres://", () => {
    const url = DIRECT_URL.replace("postgresql://", "postgres://");
    const env = createDbToolingEnv({
      requireConnection: true,
      runtimeEnv: { DATABASE_URL_UNPOOLED: url },
    });

    expect(env.DATABASE_URL_UNPOOLED).toBe(url);
  });

  it("menolak URL hilang bila requireConnection true", () => {
    expect(() =>
      createDbToolingEnv({ requireConnection: true, runtimeEnv: {} })
    ).toThrow(/Env tidak valid: .*DATABASE_URL_UNPOOLED/u);
  });

  it("menerima URL hilang bila requireConnection false", () => {
    const env = createDbToolingEnv({
      requireConnection: false,
      runtimeEnv: {},
    });

    expect(env.DATABASE_URL_UNPOOLED).toBeUndefined();
  });

  it("string kosong dianggap hilang bila requireConnection true", () => {
    expect(() =>
      createDbToolingEnv({
        requireConnection: true,
        runtimeEnv: { DATABASE_URL_UNPOOLED: "" },
      })
    ).toThrow(/DATABASE_URL_UNPOOLED/u);
  });

  it("string kosong dianggap undefined bila requireConnection false", () => {
    const env = createDbToolingEnv({
      requireConnection: false,
      runtimeEnv: { DATABASE_URL_UNPOOLED: "" },
    });

    expect(env.DATABASE_URL_UNPOOLED).toBeUndefined();
  });

  it.each([
    ["http://", DIRECT_URL.replace("postgresql://", "http://")],
    ["https://", DIRECT_URL.replace("postgresql://", "https://")],
    ["mysql://", DIRECT_URL.replace("postgresql://", "mysql://")],
  ])("menolak %s", (_label, url) => {
    expect(() =>
      createDbToolingEnv({
        requireConnection: true,
        runtimeEnv: { DATABASE_URL_UNPOOLED: url },
      })
    ).toThrow(/DATABASE_URL_UNPOOLED/u);
  });

  it("menolak host -pooler walau requireConnection false", () => {
    for (const requireConnection of [true, false]) {
      expect(() =>
        createDbToolingEnv({
          requireConnection,
          runtimeEnv: { DATABASE_URL_UNPOOLED: POOLED_URL },
        })
      ).toThrow(/-pooler/u);
    }
  });

  it("pesan error tidak memuat nilai URL atau password", () => {
    for (const url of [
      POOLED_URL,
      DIRECT_URL.replace("postgresql://", "http://"),
    ]) {
      const error = captureError(() =>
        createDbToolingEnv({
          requireConnection: true,
          runtimeEnv: { DATABASE_URL_UNPOOLED: url },
        })
      );

      expect(error.message).toMatch(/DATABASE_URL_UNPOOLED/u);
      expect(error.message).not.toContain(FAKE_PASSWORD);
      expect(error.message).not.toContain("neon.tech");
    }
  });

  it("mengabaikan var lain dan nilai non-primitif", () => {
    const env = createDbToolingEnv({
      requireConnection: true,
      runtimeEnv: {
        BUCKET: { put: () => null },
        DATABASE_URL_UNPOOLED: DIRECT_URL,
        OTHER: "x",
      },
    });

    expect(env.DATABASE_URL_UNPOOLED).toBe(DIRECT_URL);
  });

  it.each([
    ["databaseUrlSchema", databaseUrlSchema],
    ["unpooledDatabaseUrlSchema", unpooledDatabaseUrlSchema],
  ])("%s menolak bukan-URL sebagai issue, tanpa melempar", (_name, schema) => {
    const result = schema.safeParse(`bukan-url-${FAKE_PASSWORD}`);

    expect(result.success).toBeFalsy();
  });

  it("bukan-URL ditolak dengan pesan env tanpa membocorkan nilai", () => {
    const error = captureError(() =>
      createDbToolingEnv({
        requireConnection: true,
        runtimeEnv: { DATABASE_URL_UNPOOLED: `bukan-url-${FAKE_PASSWORD}` },
      })
    );

    expect(error.message).toMatch(/^Env tidak valid: DATABASE_URL_UNPOOLED/u);
    expect(error.message).not.toContain(FAKE_PASSWORD);
  });
});
