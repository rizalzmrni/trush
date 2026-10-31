import type { WebEnv } from "@trush/env/web";

const NONCE_BYTES = 16;
// Tanpa `preload`: pendaftaran preload list adalah keputusan pemilik domain.
const HSTS = "max-age=31536000; includeSubDomains";

/**
 * Host tanpa HSTS karena bukan domain resmi (`docs/react-router.md`). Pola sama
 * dengan `NON_OFFICIAL_HOST` di apps/api (disalin, bukan diimpor lintas app).
 */
const NON_OFFICIAL_HOST =
  /(?:^localhost|^127\.0\.0\.1|\.workers\.dev)(?::\d+)?$/u;

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
  const isOfficialHost = !NON_OFFICIAL_HOST.test(new URL(requestUrl).host);
  if (env.APP_ENV === "production" && isOfficialHost) {
    headers.set("Strict-Transport-Security", HSTS);
  }
};
