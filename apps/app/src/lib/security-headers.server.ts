import { isOfficialHost } from "@trush/core/hosts";
import type { AppEnv } from "@trush/env/app";

const NONCE_BYTES = 16;
// Tanpa `preload`: pendaftaran preload list adalah keputusan pemilik domain.
const HSTS = "max-age=31536000; includeSubDomains";

/** Skrip + iframe widget Cloudflare Turnstile (`docs/auth-plugins.md`). */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/** Nonce base64 acak per request untuk `script-src`. */
export const createNonce = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  return btoa(String.fromCodePoint(...bytes));
};

interface CspOptions {
  readonly env: AppEnv;
  readonly nonce: string;
  /** Halaman memuat widget Turnstile (form auth). */
  readonly turnstile: boolean;
}

const contentSecurityPolicy = ({
  env,
  nonce,
  turnstile,
}: CspOptions): string => {
  const apiOrigin = new URL(env.VITE_API_URL).origin;
  // Browser memanggil api langsung (`queryFn` klien); dev server Vite memakai
  // WebSocket untuk HMR.
  const connect = ["'self'", apiOrigin];
  if (env.APP_ENV === "development") {
    connect.push("ws:", "wss:");
  }
  const turnstileSource = turnstile ? ` ${TURNSTILE_ORIGIN}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${turnstileSource}`,
    // Atribut `style` dari komponen Base UI dan CSS yang disuntik Vite saat dev.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    `frame-src ${turnstile ? TURNSTILE_ORIGIN : "'none'"}`,
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
    turnstile = false,
  }: {
    env: AppEnv;
    nonce: string;
    /** URL request dokumen; host-nya menentukan HSTS. */
    requestUrl: string | URL;
    /** Izinkan domain Turnstile; hanya untuk halaman form auth. */
    turnstile?: boolean;
  }
): void => {
  headers.set(
    "Content-Security-Policy",
    contentSecurityPolicy({ env, nonce, turnstile })
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Tanpa HSTS di localhost dan `*.workers.dev` (`@trush/core/hosts`).
  if (
    env.APP_ENV === "production" &&
    isOfficialHost(new URL(requestUrl).host)
  ) {
    headers.set("Strict-Transport-Security", HSTS);
  }
};
