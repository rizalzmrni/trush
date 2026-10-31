import { describe, expect, it } from "vitest";

import { createAppEnv } from "./app";

const validEnv = {
  APP_ENV: "development",
  VITE_API_URL: "http://localhost:8787",
  VITE_APP_ENV: "development",
} as const;

const clientEnv = {
  VITE_API_URL: "https://api.example.test",
  VITE_APP_ENV: "staging",
} as const;

describe("createAppEnv di server", () => {
  it("parse env valid", () => {
    const env = createAppEnv({ isServer: true, runtimeEnv: validEnv });

    expect(env.APP_ENV).toBe("development");
    expect(env.VITE_APP_ENV).toBe("development");
    expect(env.VITE_API_URL).toBe("http://localhost:8787");
  });

  it("tanpa window dianggap server", () => {
    const env = createAppEnv({ runtimeEnv: validEnv });

    expect(env.APP_ENV).toBe("development");
  });

  it.each(["APP_ENV", "VITE_APP_ENV", "VITE_API_URL"] as const)(
    "menolak bila %s hilang",
    (name) => {
      const { [name]: _omitted, ...rest } = validEnv;

      expect(() => createAppEnv({ isServer: true, runtimeEnv: rest })).toThrow(
        new RegExp(`Env tidak valid: .*${name}`, "u")
      );
    }
  );

  it("menolak VITE_API_URL bukan URL tanpa membocorkan nilainya", () => {
    const fakeValue = "nilai-palsu-bukan-url";
    const create = () =>
      createAppEnv({
        isServer: true,
        runtimeEnv: { ...validEnv, VITE_API_URL: fakeValue },
      });

    expect(create).toThrow(/VITE_API_URL/u);
    expect(create).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(fakeValue),
      })
    );
  });

  it("menolak VITE_APP_ENV yang berbeda dari APP_ENV", () => {
    expect(() =>
      createAppEnv({
        isServer: true,
        runtimeEnv: { ...validEnv, VITE_APP_ENV: "production" },
      })
    ).toThrow(/VITE_APP_ENV.*APP_ENV/u);
  });

  it("binding non-primitif (Service Binding) disaring dari runtimeEnv", () => {
    const env = createAppEnv({
      isServer: true,
      runtimeEnv: { ...validEnv, API: { fetch: () => null } },
    });

    expect(env).not.toHaveProperty("API");
  });
});

describe("createAppEnv di klien", () => {
  it("parse var klien tanpa var server", () => {
    const env = createAppEnv({ isServer: false, runtimeEnv: clientEnv });

    expect(env.VITE_APP_ENV).toBe("staging");
    expect(env.VITE_API_URL).toBe("https://api.example.test");
  });

  it("akses var server dari klien melempar error", () => {
    const env = createAppEnv({
      isServer: false,
      runtimeEnv: { ...clientEnv, APP_ENV: "staging" },
    });

    expect(() => env.APP_ENV).toThrow(/server-side/u);
  });

  it("menolak var klien yang hilang", () => {
    expect(() =>
      createAppEnv({ isServer: false, runtimeEnv: { VITE_APP_ENV: "staging" } })
    ).toThrow(/VITE_API_URL/u);
  });
});
