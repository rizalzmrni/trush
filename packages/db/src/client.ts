import { Pool, neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";

import * as schema from "./schema/index";

/**
 * Bagian env yang dibutuhkan klien DB. Pemanggil meneruskan hasil factory
 * `@trush/env` (mis. `createApiEnv`), bukan `c.env` mentah.
 */
export interface DbEnv {
  /** Connection string pooled Neon (host `-pooler`). */
  readonly DATABASE_URL: string;
}

/**
 * Klien query untuk Workers (`neon-http`). Buat per request; tidak ada klien
 * global. `db.transaction()` tidak didukung driver ini: pakai `db.batch([...])`
 * atau `createTransactionalDb`.
 */
export const createDb = (env: DbEnv) =>
  drizzleHttp({ client: neon(env.DATABASE_URL), schema });

export type Database = ReturnType<typeof createDb>;

/**
 * Klien transaksi interaktif (`neon-serverless` + `Pool` WebSocket). Buat per
 * request dan tutup setelah respons: `ctx.waitUntil(close())`.
 */
export const createTransactionalDb = (env: DbEnv) => {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzleServerless({ client: pool, schema });
  const close = (): Promise<void> => pool.end();
  return { close, db };
};

export type TransactionalDatabase = ReturnType<
  typeof createTransactionalDb
>["db"];
