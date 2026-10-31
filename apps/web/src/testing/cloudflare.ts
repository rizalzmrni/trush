import { RouterContextProvider } from "react-router";

import { cloudflareContext } from "../lib/cloudflare";

/**
 * Env uji lengkap (nilai palsu). `VITE_*` di produksi dibakar dari
 * `import.meta.env` saat build; di test diberikan lewat binding agar hasil
 * tidak bergantung pada file `.env` lokal developer.
 */
export const TEST_ENV = {
  APP_ENV: "development",
  VITE_APP_ENV: "development",
  VITE_APP_URL: "https://app.example.test",
  VITE_SITE_URL: "https://trush.example.test",
} as const;

export type TestEnvOverrides = Partial<Record<keyof typeof TEST_ENV, string>>;

/** Lingkungan sama untuk server dan klien (`APP_ENV` = `VITE_APP_ENV`). */
export const envFor = (
  appEnv: "development" | "staging" | "production"
): TestEnvOverrides => ({ APP_ENV: appEnv, VITE_APP_ENV: appEnv });

/** Promise `waitUntil` yang dijadwalkan selama test (tidak ditunggu runtime). */
export const pendingWaitUntil: Promise<unknown>[] = [];

const executionContext: Pick<
  ExecutionContext,
  "passThroughOnException" | "props" | "waitUntil"
> = {
  passThroughOnException: () => {
    throw new Error("passThroughOnException tidak dipakai apps/web.");
  },
  props: {},
  waitUntil: (promise) => {
    pendingWaitUntil.push(promise);
  },
};

/** `RouterContextProvider` berisi `cloudflareContext`, seperti `src/worker.ts`. */
export const createTestContext = (
  overrides: TestEnvOverrides = {}
): RouterContextProvider => {
  const env: Env = { ...TEST_ENV, ...overrides };
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    // Loader web hanya membaca `env`; anggota ExecutionContext lain tidak dipakai.
    ctx: executionContext as ExecutionContext,
    env,
  });
  return context;
};
