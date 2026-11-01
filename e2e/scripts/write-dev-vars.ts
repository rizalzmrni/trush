/**
 * Menulis `.dev.vars.e2e` (binding Worker lingkungan lokal `e2e`) untuk
 * `apps/api`, `apps/app`, dan `apps/web`. Bila file ini ada, `.dev.vars` umum
 * diabaikan wrangler, jadi semua var harus ada di dalamnya. `VITE_*` tidak
 * ditulis di sini: Playwright meneruskannya lewat env `webServer`.
 *
 * Dasarnya `.dev.vars.example` yang di-commit (semua nilainya palsu),
 * sehingga var baru di contoh otomatis ikut. Yang ditimpa: penanda e2e
 * (`E2E=true`, `PHONE_DRIVER=memory`), kunci uji Turnstile, URL lokal, secret
 * auth acak sekali pakai, dan `DATABASE_URL` / `DATABASE_URL_UNPOOLED` dari
 * env proses (CI: branch Neon sementara; lokal: env developer). Nilai DB
 * tidak pernah dicetak. `.dev.vars` dan `.env*` tidak pernah dibaca atau
 * ditulis.
 *
 * Jalankan dari root: `bun run e2e/scripts/write-dev-vars.ts`.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

const API_URL = "http://localhost:8787";
const APP_URL = "http://localhost:5174";
const WEB_URL = "http://localhost:5173";

/** Kunci uji Cloudflare Turnstile yang selalu lolos (docs/auth-plugins.md). */
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";
const AUTH_SECRET_BYTES = 32;

/** Var DB yang nilainya hanya dari env proses, tidak dari contoh. */
const DATABASE_KEYS = ["DATABASE_URL", "DATABASE_URL_UNPOOLED"] as const;

const EXAMPLE_FILE = ".dev.vars.example";
const TARGET_FILE = ".dev.vars.e2e";

type AppName = "api" | "app" | "web";

/** Nilai e2e yang menimpa `.dev.vars.example`, per app. */
const OVERRIDES: Readonly<Record<AppName, Readonly<Record<string, string>>>> = {
  api: {
    APP_ENV: "development",
    BETTER_AUTH_SECRET: randomBytes(AUTH_SECRET_BYTES).toString("base64"),
    BETTER_AUTH_URL: API_URL,
    CORS_ORIGINS: `${APP_URL},${WEB_URL}`,
    E2E: "true",
    PHONE_DRIVER: "memory",
    TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET,
  },
  app: { APP_ENV: "development" },
  web: { APP_ENV: "development" },
};

const LINE = /^\s*(?<key>[A-Z][A-Z0-9_]*)\s*=(?<value>.*)$/u;
const NEEDS_QUOTES = /[\s"'#]/u;
const NEWLINE = /\r?\n/u;

/** `KEY=value` per baris; komentar dan baris kosong diabaikan. */
const parseEnvFile = (source: string): Map<string, string> => {
  const vars = new Map<string, string>();
  for (const line of source.split(NEWLINE)) {
    const groups = LINE.exec(line)?.groups;
    if (groups?.key !== undefined) {
      vars.set(groups.key, (groups.value ?? "").trim());
    }
  }
  return vars;
};

/** Nilai berisi spasi/kutip/`#` dikutip agar dibaca utuh oleh dotenv. */
const formatValue = (value: string): string =>
  NEEDS_QUOTES.test(value) ? JSON.stringify(value) : value;

const fail = (message: string): never => {
  process.stderr.write(`write-dev-vars: ${message}\n`);
  process.exit(1);
};

/** Gabungkan contoh + override + nilai DB dari env proses (wajib ada). */
const buildVars = (app: AppName): Map<string, string> => {
  const examplePath = path.join(ROOT, "apps", app, EXAMPLE_FILE);
  if (!existsSync(examplePath)) {
    fail(`apps/${app}/${EXAMPLE_FILE} tidak ditemukan.`);
  }
  const vars = parseEnvFile(readFileSync(examplePath, "utf-8"));
  for (const [key, value] of Object.entries(OVERRIDES[app])) {
    vars.set(key, value);
  }
  for (const key of DATABASE_KEYS) {
    if (vars.has(key)) {
      vars.set(
        key,
        process.env[key] ||
          fail(
            `${key} wajib ada di env proses (CI: branch Neon e2e; lokal: branch Neon dev).`
          )
      );
    }
  }
  return vars;
};

const writeDevVars = (app: AppName, vars: ReadonlyMap<string, string>) => {
  const body = [...vars]
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join("\n");
  // Nama target konstan `.dev.vars.e2e`: `.dev.vars` umum tidak pernah ditulis.
  writeFileSync(
    path.join(ROOT, "apps", app, TARGET_FILE),
    `# Dibuat e2e/scripts/write-dev-vars.ts; jangan disunting atau di-commit.\n${body}\n`,
    { mode: 0o600 }
  );
  process.stdout.write(
    `write-dev-vars: apps/${app}/${TARGET_FILE} (${vars.size} var)\n`
  );
};

// Bangun semua dulu: var DB yang hilang menggagalkan script sebelum ada file
// yang ditulis, jadi tidak tersisa campuran file baru dan lama.
const APPS: readonly AppName[] = ["api", "app", "web"];
const prepared = APPS.map((app) => [app, buildVars(app)] as const);
for (const [app, vars] of prepared) {
  writeDevVars(app, vars);
}
