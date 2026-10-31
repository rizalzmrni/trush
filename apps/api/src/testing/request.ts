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
} as const;

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
