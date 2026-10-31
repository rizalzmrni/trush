import { eq, sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb } from "../testing";
import { primaryId, timestamps } from "./columns";

const UUID_V7 =
  /^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u;

// Tabel uji: hanya ada di test, tanpa migrasi.
const widgets = pgTable("widgets", {
  id: primaryId(),
  name: text("name").notNull(),
  ...timestamps,
});

const CREATE_WIDGETS = sql`
  create table widgets (
    id uuid primary key,
    name text not null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
  )
`;

type TestDbHandle = Awaited<ReturnType<typeof createTestDb>>;

describe("kolom primaryId + timestamps", () => {
  let handle: TestDbHandle;

  beforeEach(async () => {
    handle = await createTestDb();
    await handle.db.execute(CREATE_WIDGETS);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await handle.close();
  });

  it("insert tanpa id menghasilkan UUIDv7", async () => {
    const [row] = await handle.db
      .insert(widgets)
      .values({ name: "a" })
      .returning();

    expect(row?.id).toMatch(UUID_V7);
  });

  it("id tiap baris unik dan terurut waktu insert", async () => {
    const inserted = await handle.db
      .insert(widgets)
      .values([{ name: "a" }, { name: "b" }, { name: "c" }])
      .returning({ id: widgets.id });
    const ids = inserted.map((row) => row.id);

    const ordered = await handle.db
      .select({ id: widgets.id })
      .from(widgets)
      .orderBy(widgets.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ordered.map((row) => row.id)).toStrictEqual(ids);
  });

  it("id eksplisit tetap dipakai", async () => {
    const id = "01900000-0000-7000-8000-000000000001";
    const [row] = await handle.db
      .insert(widgets)
      .values({ id, name: "a" })
      .returning();

    expect(row?.id).toBe(id);
  });

  it("created_at dan updated_at terisi saat insert", async () => {
    const [row] = await handle.db
      .insert(widgets)
      .values({ name: "a" })
      .returning();

    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.updatedAt).toBeInstanceOf(Date);
  });

  it("updated_at berubah saat update lewat Drizzle, created_at tetap", async () => {
    vi.useFakeTimers({
      now: new Date("2026-10-31T00:00:00.000Z"),
      toFake: ["Date"],
    });
    const [created] = await handle.db
      .insert(widgets)
      .values({ name: "a" })
      .returning();
    if (!created) {
      throw new Error("insert tidak mengembalikan baris");
    }

    const later = new Date("2026-11-01T12:00:00.000Z");
    vi.setSystemTime(later);
    const [updated] = await handle.db
      .update(widgets)
      .set({ name: "b" })
      .where(eq(widgets.id, created.id))
      .returning();

    expect(updated?.name).toBe("b");
    expect(updated?.updatedAt.getTime()).toBe(later.getTime());
    expect(updated?.createdAt.getTime()).toBe(created.createdAt.getTime());
  });
});
