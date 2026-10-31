import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "./schema/index";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * Database Postgres in-memory (PGlite) dengan semua migrasi di `drizzle/`
 * sudah diterapkan. Hanya untuk test di Node; panggil `close()` setelah test.
 */
export const createTestDb = async () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  const close = (): Promise<void> => client.close();
  return { close, db };
};

export type TestDatabase = Awaited<ReturnType<typeof createTestDb>>["db"];
