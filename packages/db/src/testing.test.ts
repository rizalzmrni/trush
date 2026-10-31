import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import journal from "../drizzle/meta/_journal.json";
import { createTestDb } from "./testing";

type TestDbHandle = Awaited<ReturnType<typeof createTestDb>>;

const opened: TestDbHandle[] = [];

const openTestDb = async (): Promise<TestDbHandle> => {
  const handle = await createTestDb();
  opened.push(handle);
  return handle;
};

describe(createTestDb, () => {
  afterEach(async () => {
    const handles = opened.splice(0);
    await Promise.all(handles.map((handle) => handle.close()));
  });

  it("membuat database yang bisa di-query", async () => {
    const { db } = await openTestDb();

    const result = await db.execute<{ ok: number }>(sql`select 1 as ok`);

    expect(result.rows).toStrictEqual([{ ok: 1 }]);
  });

  it("menerapkan satu migrasi per entri _journal.json", async () => {
    const { db } = await openTestDb();

    const result = await db.execute<{ total: number }>(
      sql`select count(*)::int as total from drizzle.__drizzle_migrations`
    );

    expect(journal.entries.length).toBeGreaterThan(0);
    expect(result.rows).toStrictEqual([{ total: journal.entries.length }]);
  });

  it("mencatat waktu migrasi sesuai journal, urut", async () => {
    const { db } = await openTestDb();

    const result = await db.execute<{ created_at: string }>(
      sql`select created_at from drizzle.__drizzle_migrations order by id`
    );

    expect(result.rows.map((row) => Number(row.created_at))).toStrictEqual(
      journal.entries.map((entry) => entry.when)
    );
  });

  it("dua instance terisolasi", async () => {
    const first = await openTestDb();
    const second = await openTestDb();

    await first.db.execute(sql`create table isolasi (nilai int)`);
    await first.db.execute(sql`insert into isolasi values (1)`);

    const inFirst = await first.db.execute<{ nilai: number }>(
      sql`select nilai from isolasi`
    );
    const inSecond = await second.db.execute<{ found: string | null }>(
      sql`select to_regclass('public.isolasi')::text as found`
    );

    expect(inFirst.rows).toStrictEqual([{ nilai: 1 }]);
    expect(inSecond.rows).toStrictEqual([{ found: null }]);
  });

  it("close() tidak melempar", async () => {
    const { close } = await createTestDb();

    await expect(close()).resolves.toBeUndefined();
  });
});
