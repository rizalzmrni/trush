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

export type AppEnv = ReturnType<typeof createAppEnv>;
