import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

/**
 * Binding uji: nilai palsu, tidak pernah dari `.dev.vars`. BetterStack
 * sengaja kosong agar test tidak mengirim log ke jaringan.
 */
const TEST_BINDINGS = {
  API_DOCS_ENABLED: "true",
  APP_ENV: "development",
  CORS_ORIGINS: "http://localhost:5173,http://localhost:5174",
  LOG_LEVEL: "info",
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
