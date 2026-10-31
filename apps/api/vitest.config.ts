import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

/**
 * Binding uji: nilai palsu, tidak pernah dari `.dev.vars`. BetterStack
 * sengaja kosong agar test tidak mengirim log ke jaringan. `DATABASE_URL`
 * menunjuk host palsu: test worker tidak boleh menyentuh DB (pakai project
 * `db` + PGlite). Turnstile memakai kunci uji Cloudflare.
 */
const TEST_BINDINGS = {
  API_DOCS_ENABLED: "true",
  APP_ENV: "development",
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:8787",
  CORS_ORIGINS: "http://localhost:5173,http://localhost:5174",
  DATABASE_URL:
    "postgresql://user:password@ep-example-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
  LOG_LEVEL: "info",
  PHONE_DRIVER: "memory",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
} as const;

const DB_TEST_GLOB = "src/**/*.db.test.ts";

// `createTestDb()` (PGlite) memuat WASM + migrasi; default 5 detik terlalu ketat.
const PGLITE_TIMEOUT_MS = 30_000;

export default defineConfig({
  test: {
    projects: [
      {
        // Handler & middleware di workerd asli.
        plugins: [
          cloudflareTest({
            miniflare: { bindings: TEST_BINDINGS },
            wrangler: { configPath: "./wrangler.jsonc" },
          }),
        ],
        test: {
          exclude: ["**/node_modules/**", DB_TEST_GLOB],
          include: ["src/**/*.test.ts"],
          name: "worker",
        },
      },
      {
        // Service yang menyentuh DB: Node + PGlite (`@trush/db/testing`).
        test: {
          environment: "node",
          hookTimeout: PGLITE_TIMEOUT_MS,
          include: [DB_TEST_GLOB],
          name: "db",
          testTimeout: PGLITE_TIMEOUT_MS,
        },
      },
    ],
  },
});
