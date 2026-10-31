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
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
} as const;

// Project `worker` (workerd). Project `db` (Node + PGlite, `*.db.test.ts`)
// ditambahkan bersama `packages/db` (B4).
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: { bindings: TEST_BINDINGS },
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
  test: {
    exclude: ["**/node_modules/**", "**/*.db.test.ts"],
    include: ["src/**/*.test.ts"],
    name: "worker",
  },
});
