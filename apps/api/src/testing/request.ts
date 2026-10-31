import { exports } from "cloudflare:workers";

import app from "../index";

/** Origin tiruan untuk URL request test; tidak pernah dihubungi jaringan. */
export const TEST_ORIGIN = "http://localhost";

/** Origin yang terdaftar di `CORS_ORIGINS` binding uji (`vitest.config.ts`). */
export const ALLOWED_ORIGIN = "http://localhost:5173";

/**
 * Request ke Worker lewat `exports.default.fetch`, memakai binding uji dari
 * `vitest.config.ts` (APP_ENV=development, API_DOCS_ENABLED=true).
 */
export const fetchWorker = (path: string, init?: RequestInit) =>
  exports.default.fetch(new Request(`${TEST_ORIGIN}${path}`, init));

/** Binding valid minimal untuk `requestWithEnv` (semua nilai palsu). */
export const BASE_ENV = {
  API_DOCS_ENABLED: "false",
  APP_ENV: "development",
  CORS_ORIGINS: "http://localhost:5173,http://localhost:5174",
  LOG_LEVEL: "info",
  DATABASE_URL:
    "postgresql://user:password@ep-example-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:8787",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
} as const;

/**
 * Penimpa agar `BASE_ENV` lolos guard production: Turnstile bukan kunci uji
 * Cloudflare dan `BETTER_AUTH_URL` https (nilai palsu).
 */
export const PRODUCTION_OVERRIDES = {
  APP_ENV: "production",
  BETTER_AUTH_URL: "https://api.example.com",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAAfake-production-secret",
} as const;

/** `BASE_ENV` untuk `APP_ENV` tertentu; production memakai penimpa di atas. */
export const envForAppEnv = (appEnv: string): Record<string, string> =>
  appEnv === "production"
    ? { ...BASE_ENV, ...PRODUCTION_OVERRIDES }
    : { ...BASE_ENV, APP_ENV: appEnv };

/**
 * ExecutionContext tiruan: menampung promise `waitUntil` agar bisa ditunggu
 * sebelum test selesai (seperti runtime menunggu setelah respons).
 */
const createExecutionContext = () => {
  const pending: Promise<unknown>[] = [];
  const context = {
    passThroughOnException: () => {
      throw new Error("passThroughOnException tidak dipakai api.");
    },
    props: {},
    waitUntil: (promise: Promise<unknown>) => {
      pending.push(promise);
    },
  };
  return { context, settle: () => Promise.allSettled(pending) };
};

/**
 * Request ke app dengan binding berbeda dari default (mis. production), lewat
 * `app.request`. `url` boleh absolut agar host bisa diatur (uji HSTS).
 */
export const requestWithEnv = async (
  url: string,
  env: Record<string, string>,
  init?: RequestInit
): Promise<Response> => {
  const { context, settle } = createExecutionContext();
  const response = await app.request(
    url.startsWith("/") ? `${TEST_ORIGIN}${url}` : url,
    init,
    env,
    context
  );
  await settle();
  return response;
};
