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
export const createApiEnv = ({ runtimeEnv }: CreateApiEnvOptions) =>
  createEnv({
    clientPrefix: "VITE_",
    client: {},
    server: {
      APP_ENV: appEnvSchema,
      API_DOCS_ENABLED: booleanFlagSchema.default(false),
      CORS_ORIGINS: originListSchema,
      LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
    },
    runtimeEnv: toRuntimeEnv(runtimeEnv),
    isServer: true,
    emptyStringAsUndefined: true,
    onValidationError: throwEnvError,
  });

export type ApiEnv = ReturnType<typeof createApiEnv>;
