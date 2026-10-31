import { existsSync } from "node:fs";

import { createDbToolingEnv } from "@trush/env/db";
import { defineConfig } from "drizzle-kit";

// Lokal: isi `packages/db/.dev.vars` (lihat `.dev.vars.example`). Var yang
// sudah ada di shell/CI tidak ditimpa.
const LOCAL_ENV_FILE = ".dev.vars";
if (existsSync(LOCAL_ENV_FILE)) {
  process.loadEnvFile(LOCAL_ENV_FILE);
}

// `generate` tidak menyambung ke DB, jadi URL boleh kosong.
const env = createDbToolingEnv({
  requireConnection: !process.argv.includes("generate"),
  runtimeEnv: process.env,
});

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: env.DATABASE_URL_UNPOOLED ?? "" },
  strict: true,
  verbose: true,
});
