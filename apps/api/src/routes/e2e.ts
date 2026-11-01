import { createRoute } from "@hono/zod-openapi";
import {
  e2eOutboxQuerySchema,
  e2eOutboxResponseSchema,
} from "@trush/core/schemas/e2e";
import { createMiddleware } from "hono/factory";

import type { AppContext } from "../context";
import { notFound } from "../middleware/error";
import { createRouter, errorResponse } from "../openapi";
import { clearOutbox, listOutbox } from "../services/e2e-outbox";

const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;

export const E2E_OUTBOX_PATH = "/__e2e/outbox";

/**
 * Route `/__e2e/*` hanya hidup bila `E2E=true`, yang oleh `createApiEnv`
 * hanya sah saat `APP_ENV=development` + `PHONE_DRIVER=memory`. Dicek ulang
 * di sini agar tetap 404 walau aturan env berubah. Di luar itu 404 seperti
 * route tak dikenal.
 */
export const e2eGuard = createMiddleware<AppContext>(async (c, next) => {
  const { env } = c.var;
  if (!env.E2E || env.APP_ENV !== "development") {
    return notFound(c);
  }
  return await next();
});

const getOutbox = createRoute({
  description:
    "Hanya lingkungan lokal e2e (`E2E=true`). Pesan driver memory per isolate Worker, terbaru dulu.",
  hide: true,
  method: "get",
  middleware: [e2eGuard] as const,
  path: E2E_OUTBOX_PATH,
  request: { query: e2eOutboxQuerySchema },
  responses: {
    [HTTP_OK]: {
      content: { "application/json": { schema: e2eOutboxResponseSchema } },
      description: "Pesan outbox, disaring `to` bila diisi.",
    },
    400: errorResponse("Query tidak valid."),
    404: errorResponse("Bukan lingkungan e2e."),
  },
  summary: "Baca outbox driver memory (e2e)",
  tags: ["E2E"],
});

const deleteOutbox = createRoute({
  description:
    "Hanya lingkungan lokal e2e (`E2E=true`). Mengosongkan outbox, atau hanya pesan untuk `to`.",
  hide: true,
  method: "delete",
  middleware: [e2eGuard] as const,
  path: E2E_OUTBOX_PATH,
  request: { query: e2eOutboxQuerySchema },
  responses: {
    [HTTP_NO_CONTENT]: { description: "Outbox dikosongkan." },
    400: errorResponse("Query tidak valid."),
    404: errorResponse("Bukan lingkungan e2e."),
  },
  summary: "Kosongkan outbox driver memory (e2e)",
  tags: ["E2E"],
});

/**
 * Tidak ikut `AppType` (bukan kontrak klien RPC) dan disembunyikan dari
 * `/openapi.json`; kontraknya di `@trush/core/schemas/e2e`.
 */
export const e2eRoutes = createRouter()
  .openapi(getOutbox, (c) =>
    c.json(listOutbox(c.req.valid("query").to), HTTP_OK)
  )
  .openapi(deleteOutbox, (c) => {
    clearOutbox(c.req.valid("query").to);
    return c.body(null, HTTP_NO_CONTENT);
  });
