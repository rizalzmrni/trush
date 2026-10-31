import { AsyncLocalStorage } from "node:async_hooks";

import { createApiEnv } from "@trush/env/api";
import {
  configureLogger,
  getRequestId,
  withRequestLogging,
} from "@trush/observability/logger";
import { createMiddleware } from "hono/factory";

import type { AppContext } from "../context";

/**
 * Satu penyimpanan konteks per isolate (bukan state per request): LogTape
 * memakai `run()` sehingga setiap request mendapat konteksnya sendiri.
 */
const contextLocalStorage = new AsyncLocalStorage<Record<string, unknown>>();

export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Middleware pertama: memvalidasi env dari `c.env`, mengonfigurasi logger
 * (sekali per isolate), memasang `requestId` sebagai konteks setiap log, dan
 * menjadwalkan flush BetterStack lewat `waitUntil` setelah respons.
 */
export const requestContext = createMiddleware<AppContext>(async (c, next) => {
  const requestId = getRequestId(c.req.raw);
  c.set("requestId", requestId);
  c.header(REQUEST_ID_HEADER, requestId);

  const env = createApiEnv({ runtimeEnv: c.env });
  c.set("env", env);

  const {
    BETTERSTACK_INGEST_URL: ingestUrl,
    BETTERSTACK_SOURCE_TOKEN: sourceToken,
  } = env;
  configureLogger({
    appEnv: env.APP_ENV,
    betterStack:
      ingestUrl && sourceToken ? { ingestUrl, sourceToken } : undefined,
    contextLocalStorage,
    level: env.LOG_LEVEL,
  });

  await withRequestLogging(c.req.raw, c.executionCtx, next, requestId);
});
