/**
 * Konfigurasi statis KHUSUS CLI `auth generate` (script `auth:generate`).
 * Memanggil factory runtime sehingga plugin dan opsi skema selalu identik.
 * Nilai palsu: `neon-http` tidak menyambung sampai ada query, dan CLI generate
 * tidak melakukan query.
 */
import { createDb } from "@trush/db";

import { createAuth } from "./auth";

export const auth = createAuth({
  db: createDb({ DATABASE_URL: "postgresql://cli:cli@localhost:5432/cli" }),
  env: {
    APP_ENV: "development",
    AUTH_COOKIE_DOMAIN: undefined,
    BETTER_AUTH_SECRET: "cli-only-secret-tidak-dipakai-runtime-0000",
    BETTER_AUTH_URL: "http://localhost:8787",
    CORS_ORIGINS: ["http://localhost:5174"],
    TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  },
});
