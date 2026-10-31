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

const noopExecutionContext = {
  passThroughOnException: () => {},
  props: {},
  waitUntil: () => {},
};

/**
 * Request ke app dengan binding berbeda dari default (mis. production), lewat
 * `app.request`. `url` boleh absolut agar host bisa diatur (uji HSTS).
 */
export const requestWithEnv = (
  url: string,
  env: Record<string, string>,
  init?: RequestInit
) =>
  app.request(
    url.startsWith("/") ? `${TEST_ORIGIN}${url}` : url,
    init,
    env,
    noopExecutionContext
  );
