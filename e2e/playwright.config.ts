import { defineConfig, devices } from "@playwright/test";

// E2E berjalan terhadap dev server lokal di lingkungan Cloudflare `e2e`
// (blok env.e2e: APP_ENV=development, E2E=true; secret di .dev.vars.e2e).
// Worker tidak membaca env proses, jadi lingkungan dipilih lewat CLOUDFLARE_ENV;
// task `dev` di turbo.json wajib meneruskannya (passThroughEnv).
// Port wajib sama dengan konfigurasi dev tiap app.
const API_URL = "http://localhost:8787";
const APP_URL = "http://localhost:5174";
const WEB_URL = "http://localhost:5173";
const isCI = Boolean(process.env.CI);

const server = (filter: string, url: string) => ({
  command: `bunx turbo run dev --filter=${filter}`,
  cwd: "..",
  env: { CLOUDFLARE_ENV: "e2e" },
  reuseExistingServer: !isCI,
  timeout: 120_000,
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
      use: { ...devices["Desktop Chrome"], storageState: ".auth/user.json" },
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
    server("@trush/api", `${API_URL}/health`),
    server("@trush/app", APP_URL),
    server("@trush/web", WEB_URL),
  ],
  workers: isCI ? 2 : undefined,
});
