import { isOfficialHost } from "@trush/core/hosts";
import type { ApiEnv } from "@trush/env/api";
import { cors as honoCors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { NONCE, secureHeaders } from "hono/secure-headers";

import type { AppContext } from "../context";
import { DOCS_PATH } from "../openapi";

const HSTS_VALUE = "max-age=31536000; includeSubDomains";

/** CDN bundel Scalar; satu-satunya host luar yang diizinkan di `/docs`. */
const SCALAR_CDN_ORIGIN = "https://cdn.jsdelivr.net";

/**
 * Bundel UMD `@scalar/api-reference` yang di-pin. Versi 1.76.3 dirilis
 * bersamaan dengan `@scalar/hono-api-reference` 0.12.17 yang terpasang
 * (sama-sama memakai `@scalar/schemas` 0.16.0). Naikkan keduanya bersamaan.
 */
export const SCALAR_BUNDLE_URL = `${SCALAR_CDN_ORIGIN}/npm/@scalar/api-reference@1.76.3/dist/browser/standalone.js`;

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
    // Hanya file bundel yang di-pin, bukan seluruh jsDelivr.
    scriptSrc: [NONCE, SCALAR_BUNDLE_URL],
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
  if (
    env?.APP_ENV === "production" &&
    isOfficialHost(new URL(c.req.url).host)
  ) {
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
