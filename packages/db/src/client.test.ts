import { describe, expect, it } from "vitest";

import { createDb, createTransactionalDb } from "./client";

// URL palsu; host .invalid tidak pernah ter-resolve. Tidak ada query yang
// dijalankan, jadi tidak ada koneksi jaringan.
const FAKE_ENV = {
  DATABASE_URL:
    "postgresql://trush:palsu@ep-fake-123-pooler.example.invalid/trush?sslmode=require",
} as const;

describe(createDb, () => {
  it("dibangun dari URL palsu tanpa melempar", () => {
    const db = createDb(FAKE_ENV);

    expect(db.select).toBeTypeOf("function");
    expect(db.batch).toBeTypeOf("function");
  });

  it("membuat instance baru per pemanggilan (tanpa klien global)", () => {
    expect(createDb(FAKE_ENV)).not.toBe(createDb(FAKE_ENV));
  });
});

describe(createTransactionalDb, () => {
  it("dibangun dari URL palsu tanpa melempar", async () => {
    const { close, db } = createTransactionalDb(FAKE_ENV);

    expect(db.transaction).toBeTypeOf("function");
    await close();
  });

  it("close() tanpa query tidak melempar", async () => {
    const { close } = createTransactionalDb(FAKE_ENV);

    await expect(close()).resolves.toBeUndefined();
  });

  it("membuat pool baru per pemanggilan", async () => {
    const first = createTransactionalDb(FAKE_ENV);
    const second = createTransactionalDb(FAKE_ENV);

    expect(first.db).not.toBe(second.db);
    await Promise.all([first.close(), second.close()]);
  });
});
