import type { ApiEnv } from "@trush/env/api";
import { cors as honoCors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { NONCE, secureHeaders } from "hono/secure-headers";

import type { AppContext } from "../context";
import { DOCS_PATH } from "../openapi";

const HSTS_VALUE = "max-age=31536000; includeSubDomains";

/** Host tanpa HSTS karena bukan domain resmi (`docs/hono-api.md`). */
const NON_OFFICIAL_HOST =
  /(?:^localhost|^127\.0\.0\.1|\.workers\.dev)(?::\d+)?$/u;

/** CDN bundel Scalar; satu-satunya host luar yang diizinkan di `/docs`. */
export const SCALAR_CDN_ORIGIN = "https://cdn.jsdelivr.net";

const SHARED_HEADERS = {
  referrerPolicy: "strict-origin-when-cross-origin",
  // HSTS dipasang manual di bawah: hanya production di domain resmi.
  strictTransportSecurity: false,
  xContentTypeOptions: "nosniff",
  xFrameOptions: "DENY",
} as const;

const apiHeaders = secureHeaders({
  ...SHARED_HEADERS,
  contentSecurityPolicy: {
    defaultSrc: ["'none'"],
    frameAncestors: ["'none'"],
  },
});

/**
 * CSP khusus `/docs` (pengecualian hanya untuk route itu): script Scalar
 * diizinkan lewat nonce per request + host CDN-nya, tanpa `'unsafe-inline'`.
 * Gaya inline tetap dibutuhkan tema Scalar.
 */
const docsHeaders = secureHeaders({
  ...SHARED_HEADERS,
  contentSecurityPolicy: {
    connectSrc: ["'self'"],
    defaultSrc: ["'none'"],
    fontSrc: ["'self'", "https://fonts.scalar.com"],
    frameAncestors: ["'none'"],
    imgSrc: ["'self'", "data:"],
    scriptSrc: [NONCE, SCALAR_CDN_ORIGIN],
    styleSrc: ["'self'", "'unsafe-inline'", SCALAR_CDN_ORIGIN],
  },
});

/**
 * `secureHeaders()` global + HSTS bersyarat. Dipasang paling luar agar respons
 * error dari middleware berikutnya (mis. env tidak valid) tetap berheader.
 */
export const securityHeaders = createMiddleware<AppContext>(async (c, next) => {
  const headers = c.req.path === DOCS_PATH ? docsHeaders : apiHeaders;
  await headers(c, next);
  // Belum terisi bila `requestContext` gagal memvalidasi env.
  const env: ApiEnv | undefined = c.get("env");
  const isOfficialHost = !NON_OFFICIAL_HOST.test(new URL(c.req.url).host);
  if (env?.APP_ENV === "production" && isOfficialHost) {
    c.header("strict-transport-security", HSTS_VALUE);
  }
});

/** CORS `credentials: true` dengan origin dari `CORS_ORIGINS`, tidak pernah `*`. */
export const cors = createMiddleware<AppContext>((c, next) =>
  honoCors({
    credentials: true,
    origin: (origin) =>
      c.var.env.CORS_ORIGINS.includes(origin) ? origin : null,
  })(c, next)
);
