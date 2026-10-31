import { Scalar } from "@scalar/hono-api-reference";
import { AUTH_BASE_PATH } from "@trush/auth";
import { createMiddleware } from "hono/factory";

import type { AppContext } from "./context";
import { authContext } from "./middleware/auth";
import { notFound, onError } from "./middleware/error";
import { requestContext } from "./middleware/request-context";
import {
  cors,
  SCALAR_BUNDLE_URL,
  securityHeaders,
} from "./middleware/security";
import {
  createRouter,
  DOCS_PATH,
  OPENAPI_DOCUMENT,
  OPENAPI_PATH,
  SESSION_SECURITY_SCHEME,
  SESSION_SECURITY_SCHEME_OBJECT,
} from "./openapi";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";

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
// Skema OpenAPI better-auth (plugin `openAPI`) mengikuti aturan `/docs`.
app.use(`${AUTH_BASE_PATH}/open-api/*`, docsGuard);
app.use("/api/*", authContext);

/** Semua endpoint better-auth (sign-in, sign-up, organisasi, 2FA, ...). */
app.on(["GET", "POST"], `${AUTH_BASE_PATH}/*`, (c) =>
  c.var.auth.handler(c.req.raw)
);

/** Route API dirangkai berantai agar tipe RPC (`AppType`) terbentuk. */
const routes = app.route("/", healthRoutes).route("/", meRoutes);

app.openAPIRegistry.registerComponent(
  "securitySchemes",
  SESSION_SECURITY_SCHEME,
  SESSION_SECURITY_SCHEME_OBJECT
);

app.doc31(OPENAPI_PATH, OPENAPI_DOCUMENT);
app.get(
  DOCS_PATH,
  Scalar((c) => ({
    cdn: SCALAR_BUNDLE_URL,
    nonce: c.get("secureHeadersNonce"),
    url: OPENAPI_PATH,
  }))
);

export type AppType = typeof routes;

export default app;
