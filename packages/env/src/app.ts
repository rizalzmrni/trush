import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import {
  appEnvSchema,
  assertSameAppEnv,
  detectServer,
  throwEnvError,
  toRuntimeEnv,
} from "./shared";
import type { RuntimeEnvInput } from "./shared";

/**
 * Site key uji Cloudflare Turnstile (`1x…AA` selalu lolos, `2x…AB` selalu
 * gagal, `3x…FF` memaksa tantangan, dst.). Ditolak saat production.
 */
const TURNSTILE_TEST_SITE_KEY = /^[123]x0{20}[A-F]{2}$/u;

export interface CreateAppEnvOptions {
  /**
   * Server (loader/action): gabungan `getCloudflare(context).env` dan
   * `import.meta.env`, karena `VITE_*` dibakar saat build. Klien:
   * `import.meta.env`.
   */
  runtimeEnv: RuntimeEnvInput;
  /** Default: tidak ada global `window`. */
  isServer?: boolean;
}

/** Env `apps/app`. Var server tidak bisa diakses dari klien. */
export const createAppEnv = ({
  runtimeEnv,
  isServer = detectServer(),
}: CreateAppEnvOptions) => {
  const env = createEnv({
    clientPrefix: "VITE_",
    client: {
      VITE_APP_ENV: appEnvSchema,
      /** URL publik `apps/api` untuk klien browser. */
      VITE_API_URL: z.url(),
      /** Site key widget Turnstile (publik). Development: `1x00000000000000000000AA`. */
      VITE_TURNSTILE_SITE_KEY: z.string().min(1),
    },
    server: {
      APP_ENV: appEnvSchema,
    },
    runtimeEnv: toRuntimeEnv(runtimeEnv),
    isServer,
    emptyStringAsUndefined: true,
    onValidationError: throwEnvError,
  });
  if (isServer) {
    assertSameAppEnv(env.APP_ENV, env.VITE_APP_ENV);
  }
  // Dicek dari VITE_APP_ENV agar berlaku juga di klien (APP_ENV hanya server).
  if (
    env.VITE_APP_ENV === "production" &&
    TURNSTILE_TEST_SITE_KEY.test(env.VITE_TURNSTILE_SITE_KEY)
  ) {
    throw new Error(
      "VITE_TURNSTILE_SITE_KEY berisi kunci uji Cloudflare; dilarang saat production."
    );
  }
  return env;
};

export type AppEnv = ReturnType<typeof createAppEnv>;
