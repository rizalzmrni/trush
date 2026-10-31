import { Scalar } from "@scalar/hono-api-reference";
import { createMiddleware } from "hono/factory";

import type { AppContext } from "./context";
import { notFound, onError } from "./middleware/error";
import { requestContext } from "./middleware/request-context";
import { cors, securityHeaders } from "./middleware/security";
import {
  createRouter,
  DOCS_PATH,
  OPENAPI_DOCUMENT,
  OPENAPI_PATH,
} from "./openapi";
import { healthRoutes } from "./routes/health";

export type { Bindings } from "./context";

/**
 * `/docs` dan `/openapi.json`: selalu di development, di lingkungan lain hanya
 * bila `API_DOCS_ENABLED=true`. Nonaktif → 404 seperti route tak dikenal.
 */
const docsGuard = createMiddleware<AppContext>(async (c, next) => {
  const { env } = c.var;
  if (env.APP_ENV !== "development" && !env.API_DOCS_ENABLED) {
    return notFound(c);
  }
  return await next();
});

const app = createRouter();

app.onError(onError);
app.notFound(notFound);

app.use("*", securityHeaders, requestContext, cors);
app.use(OPENAPI_PATH, docsGuard);
app.use(DOCS_PATH, docsGuard);

/** Route API dirangkai berantai agar tipe RPC (`AppType`) terbentuk. */
const routes = app.route("/", healthRoutes);

app.doc31(OPENAPI_PATH, OPENAPI_DOCUMENT);
app.get(
  DOCS_PATH,
  Scalar((c) => ({ nonce: c.get("secureHeadersNonce"), url: OPENAPI_PATH }))
);

export type AppType = typeof routes;

export default app;
