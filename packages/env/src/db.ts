import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { throwEnvError, toRuntimeEnv } from "./shared";
import type { RuntimeEnvInput } from "./shared";

const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

/**
 * Zod 4 tetap menjalankan refine setelah `z.url()` gagal; `new URL()` pada
 * nilai tak valid melempar TypeError yang membawa nilai mentah (bisa memuat
 * password). Kembalikan `undefined` agar refine menghasilkan issue biasa.
 */
const parseUrl = (value: string): URL | undefined =>
  URL.canParse(value) ? new URL(value) : undefined;

/** Connection string Postgres (Neon), mis. `postgresql://user:pass@host/db`. */
export const databaseUrlSchema = z
  .url({ abort: true })
  .refine((value) => POSTGRES_PROTOCOLS.has(parseUrl(value)?.protocol ?? ""), {
    message: "harus berprotokol postgres:// atau postgresql://",
  });

/**
 * Koneksi direct untuk DDL. Host `-pooler` (PgBouncer) ditolak karena migrasi
 * bisa gagal di sana.
 */
export const unpooledDatabaseUrlSchema = databaseUrlSchema.refine(
  (value) => {
    const url = parseUrl(value);
    return url !== undefined && !url.hostname.includes("-pooler");
  },
  { message: "harus koneksi direct (host tanpa -pooler)" }
);

export interface CreateDbToolingEnvOptions {
  /** `process.env` dari tooling Node/Bun (drizzle-kit, seed). */
  runtimeEnv: RuntimeEnvInput;
  /**
   * `false` untuk perintah tanpa koneksi (mis. `drizzle-kit generate`);
   * `DATABASE_URL_UNPOOLED` lalu boleh kosong.
   */
  requireConnection: boolean;
}

/**
 * Env tooling `@trush/db` (migrasi, seed). Bukan untuk kode Worker: Worker
 * memakai `DATABASE_URL` dari factory app-nya.
 */
export const createDbToolingEnv = ({
  runtimeEnv,
  requireConnection,
}: CreateDbToolingEnvOptions) =>
  createEnv({
    clientPrefix: "VITE_",
    client: {},
    server: {
      DATABASE_URL_UNPOOLED: requireConnection
        ? unpooledDatabaseUrlSchema
        : unpooledDatabaseUrlSchema.optional(),
    },
    runtimeEnv: toRuntimeEnv(runtimeEnv),
    isServer: true,
    emptyStringAsUndefined: true,
    onValidationError: throwEnvError,
  });

export type DbToolingEnv = ReturnType<typeof createDbToolingEnv>;
