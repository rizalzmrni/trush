import { isOfficialHost } from "@trush/core/hosts";
import type { WebEnv } from "@trush/env/web";

const NONCE_BYTES = 16;
// Tanpa `preload`: pendaftaran preload list adalah keputusan pemilik domain.
const HSTS = "max-age=31536000; includeSubDomains";

/** Nonce base64 acak per request untuk `script-src`. */
export const createNonce = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  return btoa(String.fromCodePoint(...bytes));
};

const contentSecurityPolicy = (nonce: string, env: WebEnv): string => {
  // Dev server Vite memakai WebSocket untuk HMR.
  const connect = env.APP_ENV === "development" ? "'self' ws: wss:" : "'self'";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Atribut `style` dari komponen Base UI dan CSS yang disuntik Vite saat dev.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
};

/** Header keamanan untuk respons dokumen HTML (`docs/react-router.md`). */
export const applySecurityHeaders = (
  headers: Headers,
  {
    env,
    nonce,
    requestUrl,
  }: {
    env: WebEnv;
    nonce: string;
    /** URL request dokumen; host-nya menentukan HSTS. */
    requestUrl: string | URL;
  }
): void => {
  headers.set("Content-Security-Policy", contentSecurityPolicy(nonce, env));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Tanpa HSTS di localhost, loopback, dan `*.workers.dev` (`@trush/core/hosts`).
  if (
    env.APP_ENV === "production" &&
    isOfficialHost(new URL(requestUrl).host)
  ) {
    headers.set("Strict-Transport-Security", HSTS);
  }
};
