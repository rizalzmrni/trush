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

export interface CreateWebEnvOptions {
  /**
   * Server (loader/action): gabungan `getCloudflare(context).env` dan
   * `import.meta.env`, karena `VITE_*` dibakar saat build. Klien:
   * `import.meta.env`.
   */
  runtimeEnv: RuntimeEnvInput;
  /** Default: tidak ada global `window`. */
  isServer?: boolean;
}

/** Env `apps/web`. Var server tidak bisa diakses dari klien. */
export const createWebEnv = ({
  runtimeEnv,
  isServer = detectServer(),
}: CreateWebEnvOptions) => {
  const env = createEnv({
    clientPrefix: "VITE_",
    client: {
      VITE_APP_ENV: appEnvSchema,
      /** URL `apps/app` untuk tautan login/daftar. */
      VITE_APP_URL: z.url(),
      /**
       * URL publik `apps/web` sendiri, untuk canonical, `og:url`, URL gambar
       * absolut, dan `Sitemap:` di robots (`@trush/seo`). Tidak ditebak dari
       * hostname request.
       */
      VITE_SITE_URL: z.url(),
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
  return env;
};

export type WebEnv = ReturnType<typeof createWebEnv>;
