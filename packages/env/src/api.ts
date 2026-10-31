import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { databaseUrlSchema } from "./db";
import { assertPhoneEnv, phoneServerSchema } from "./phone";
import {
  appEnvSchema,
  booleanFlagSchema,
  throwEnvError,
  toRuntimeEnv,
} from "./shared";
import type { RuntimeEnvInput } from "./shared";

const LOG_LEVELS = [
  "trace",
  "debug",
  "info",
  "warning",
  "error",
  "fatal",
] as const;

/** Daftar origin dipisah koma, mis. `http://localhost:5173,http://localhost:5174`. */
const originListSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  )
  .pipe(z.array(z.url()).min(1));

/** Minimal panjang `BETTER_AUTH_SECRET` (`openssl rand -base64 32`). */
const AUTH_SECRET_MIN_LENGTH = 32;

/**
 * Secret uji Cloudflare Turnstile (`1x…` selalu lolos, `2x…` selalu gagal,
 * `3x…` token terpakai). Ditolak saat production.
 */
const TURNSTILE_TEST_SECRET = /^[123]x0+AA$/u;

/** Nama domain huruf kecil, boleh diawali titik, mis. `example.com`. */
const DOMAIN_NAME = /^\.?(?:[a-z0-9-]+\.)+[a-z]{2,}$/u;

/** Domain cookie lintas subdomain (tanpa skema/port). */
const cookieDomainSchema = z
  .string()
  .regex(DOMAIN_NAME, "harus nama domain, mis. example.com");

/** Kombinasi berbahaya saat production (lihat `docs/environments.md`). */
const assertProductionSafe = (env: {
  APP_ENV: string;
  BETTER_AUTH_URL: string;
  TURNSTILE_SECRET_KEY: string;
}): void => {
  if (env.APP_ENV !== "production") {
    return;
  }
  if (TURNSTILE_TEST_SECRET.test(env.TURNSTILE_SECRET_KEY)) {
    throw new Error(
      "TURNSTILE_SECRET_KEY berisi kunci uji Cloudflare; dilarang saat APP_ENV=production."
    );
  }
  if (new URL(env.BETTER_AUTH_URL).protocol !== "https:") {
    throw new Error("BETTER_AUTH_URL wajib https saat APP_ENV=production.");
  }
};

export interface CreateApiEnvOptions {
  /** `c.env` dari Hono. */
  runtimeEnv: RuntimeEnvInput;
}

/** Env Worker `apps/api`. Dipanggil per request, tidak di scope modul. */
export const createApiEnv = ({ runtimeEnv }: CreateApiEnvOptions) => {
  const env = createEnv({
    clientPrefix: "VITE_",
    client: {},
    server: {
      APP_ENV: appEnvSchema,
      API_DOCS_ENABLED: booleanFlagSchema.default(false),
      CORS_ORIGINS: originListSchema,
      LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
      /** URL ingest source BetterStack. Kosong: log hanya ke console. */
      BETTERSTACK_INGEST_URL: z.url().optional(),
      /** Secret. Wajib bila `BETTERSTACK_INGEST_URL` diisi. */
      BETTERSTACK_SOURCE_TOKEN: z.string().min(1).optional(),
      /** Secret. Connection string pooled Neon (host `-pooler`). */
      DATABASE_URL: databaseUrlSchema,
      /** Secret. Kunci tanda tangan sesi better-auth. */
      BETTER_AUTH_SECRET: z.string().min(AUTH_SECRET_MIN_LENGTH),
      /** URL publik Worker api (tanpa `/api/auth`), mis. `https://api.example.com`. */
      BETTER_AUTH_URL: z.url(),
      /**
       * Domain induk cookie sesi agar terbaca lintas subdomain (`app.`, `api.`).
       * Kosong: cookie hanya untuk host api (development, `*.workers.dev`).
       */
      AUTH_COOKIE_DOMAIN: cookieDomainSchema.optional(),
      /** Secret. Secret key widget Turnstile (plugin `captcha`). */
      TURNSTILE_SECRET_KEY: z.string().min(1),
      ...phoneServerSchema,
    },
    runtimeEnv: toRuntimeEnv(runtimeEnv),
    isServer: true,
    emptyStringAsUndefined: true,
    onValidationError: throwEnvError,
  });
  if (
    (env.BETTERSTACK_INGEST_URL === undefined) !==
    (env.BETTERSTACK_SOURCE_TOKEN === undefined)
  ) {
    throw new Error(
      "BETTERSTACK_INGEST_URL dan BETTERSTACK_SOURCE_TOKEN harus diisi bersama atau dikosongkan bersama."
    );
  }
  assertProductionSafe(env);
  assertPhoneEnv(env);
  return env;
};

export type ApiEnv = ReturnType<typeof createApiEnv>;
