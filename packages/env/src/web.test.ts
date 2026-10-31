import { describe, expect, it } from "vitest";

import { createWebEnv } from "./web";

const validEnv = {
  APP_ENV: "development",
  VITE_APP_ENV: "development",
  VITE_APP_URL: "http://localhost:5174",
} as const;

const clientEnv = {
  VITE_APP_ENV: "staging",
  VITE_APP_URL: "https://app.example.test",
} as const;

describe("createWebEnv di server", () => {
  it("parse env valid", () => {
    const env = createWebEnv({ isServer: true, runtimeEnv: validEnv });

    expect(env.APP_ENV).toBe("development");
    expect(env.VITE_APP_ENV).toBe("development");
    expect(env.VITE_APP_URL).toBe("http://localhost:5174");
  });

  it("tanpa window dianggap server", () => {
    const env = createWebEnv({ runtimeEnv: validEnv });

    expect(env.APP_ENV).toBe("development");
  });

  it.each(["APP_ENV", "VITE_APP_ENV", "VITE_APP_URL"] as const)(
    "menolak bila %s hilang",
    (name) => {
      const { [name]: _omitted, ...rest } = validEnv;

      expect(() => createWebEnv({ isServer: true, runtimeEnv: rest })).toThrow(
        new RegExp(`Env tidak valid: .*${name}`, "u")
      );
    }
  );

  it("menolak VITE_APP_URL bukan URL tanpa membocorkan nilainya", () => {
    const fakeValue = "nilai-palsu-bukan-url";
    const create = () =>
      createWebEnv({
        isServer: true,
        runtimeEnv: { ...validEnv, VITE_APP_URL: fakeValue },
      });

    expect(create).toThrow(/VITE_APP_URL/u);
    expect(create).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(fakeValue),
      })
    );
  });

  it("menolak VITE_APP_ENV yang berbeda dari APP_ENV", () => {
    expect(() =>
      createWebEnv({
        isServer: true,
        runtimeEnv: { ...validEnv, APP_ENV: "production" },
      })
    ).toThrow(/VITE_APP_ENV.*APP_ENV/u);
  });

  it("binding non-primitif disaring dari runtimeEnv", () => {
    const env = createWebEnv({
      isServer: true,
      runtimeEnv: { ...validEnv, ASSETS: { fetch: () => null } },
    });

    expect(env).not.toHaveProperty("ASSETS");
  });
});

describe("createWebEnv di klien", () => {
  it("parse var klien tanpa var server", () => {
    const env = createWebEnv({ isServer: false, runtimeEnv: clientEnv });

    expect(env.VITE_APP_ENV).toBe("staging");
    expect(env.VITE_APP_URL).toBe("https://app.example.test");
  });

  it("akses var server dari klien melempar error", () => {
    const env = createWebEnv({
      isServer: false,
      runtimeEnv: { ...clientEnv, APP_ENV: "staging" },
    });

    expect(() => env.APP_ENV).toThrow(/server-side/u);
  });

  it("menolak var klien yang hilang", () => {
    expect(() =>
      createWebEnv({ isServer: false, runtimeEnv: { VITE_APP_ENV: "staging" } })
    ).toThrow(/VITE_APP_URL/u);
  });
});
