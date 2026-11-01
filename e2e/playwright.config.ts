import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import { STORAGE_STATE } from "./fixtures/storage-state";
import { API_URL, APP_URL, WEB_URL } from "./fixtures/urls";

// E2E berjalan terhadap dev server lokal di lingkungan Cloudflare `e2e`
// (blok env.e2e: APP_ENV=development, E2E=true). Secret di .dev.vars.e2e,
// ditulis `bun run e2e/scripts/write-dev-vars.ts` sebelum test.
// Worker tidak membaca env proses: lingkungan dipilih lewat CLOUDFLARE_ENV
// (app/web, task turbo `dev` meneruskannya) atau `wrangler dev --env e2e`
// (api, script `dev:e2e`: hanya flag itu yang membuat wrangler membaca
// .dev.vars.e2e; pengecualian tercatat di docs/environments.md).
// Port wajib sama dengan konfigurasi dev tiap app (fixtures/urls.ts).
const isCI = Boolean(process.env.CI);

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * Service Binding `API` app → api hanya tersambung bila wrangler dev (api) dan
 * vite-plugin (app) memakai dev registry yang sama; lokasi bawaannya berbeda.
 */
const SERVER_ENV = {
  CLOUDFLARE_DEV_REGISTRY_PATH: path.join(ROOT, ".wrangler", "dev-registry"),
  CLOUDFLARE_ENV: "e2e",
  // `VITE_*` app + web (gabungan; var ekstra tidak berpengaruh). Vite
  // mendahulukan env proses di atas `.env` developer; task turbo `dev` wajib
  // meneruskan `VITE_*` (passThroughEnv). VITE_APP_ENV harus sama dengan
  // APP_ENV di .dev.vars.e2e.
  VITE_API_URL: API_URL,
  VITE_APP_ENV: "development",
  VITE_APP_URL: APP_URL,
  VITE_SITE_URL: WEB_URL,
  // Kunci uji Turnstile yang selalu lolos (docs/auth-plugins.md).
  VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
};

const SERVER_TIMEOUT_MS = 120_000;

const server = (command: string, cwd: string, url: string) => ({
  command,
  cwd,
  env: SERVER_ENV,
  // Tidak pernah memakai dev server yang sudah jalan: server non-e2e (tanpa
  // E2E/outbox, secret .dev.vars) memberi hasil palsu. Port terpakai = gagal.
  reuseExistingServer: false,
  timeout: SERVER_TIMEOUT_MS,
  url,
});

export default defineConfig({
  forbidOnly: isCI,
  fullyParallel: true,
  projects: [
    { name: "setup", testMatch: "**/auth.setup.ts" },
    {
      dependencies: ["setup"],
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
    },
  ],
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  retries: isCI ? 2 : 0,
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  use: {
    baseURL: APP_URL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: [
    server(
      "bun run dev:e2e",
      path.join(ROOT, "apps", "api"),
      `${API_URL}/health`
    ),
    server("bunx turbo run dev --filter=@trush/app", ROOT, APP_URL),
    server("bunx turbo run dev --filter=@trush/web", ROOT, WEB_URL),
  ],
  workers: isCI ? 2 : undefined,
});
