import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

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
  return env;
};

export type ApiEnv = ReturnType<typeof createApiEnv>;
