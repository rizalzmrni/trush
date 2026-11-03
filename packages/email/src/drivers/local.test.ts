import { describe, expect, it, vi } from "vitest";

import {
  createEmailOutbox,
  createLogTransport,
  createMemoryTransport,
} from "./local";
import type { EmailMessage } from "./types";

// Semua data palsu.
const message = (overrides: Partial<EmailMessage> = {}): EmailMessage => ({
  code: "482913",
  html: "<p>482913</p>",
  idempotencyKey: "verification-otp/abc",
  subject: "Kode verifikasi email trush",
  template: "verification-otp",
  text: "Kode Anda 482913",
  to: "budi@example.com",
  ...overrides,
});

const OUTBOX_LIMIT = 50;

describe(createEmailOutbox, () => {
  it("menyimpan email dengan field outbox, id unik, terbaru terakhir", () => {
    const outbox = createEmailOutbox();

    outbox.add(message());
    outbox.add(message({ code: null, template: "password-reset" }));

    const [first, second] = outbox.list();
    expect(first).toMatchObject({
      body: "Kode Anda 482913",
      code: "482913",
      idempotencyKey: "verification-otp/abc",
      subject: "Kode verifikasi email trush",
      template: "verification-otp",
      to: "budi@example.com",
    });
    expect(first?.sentAt).toBeInstanceOf(Date);
    expect(second?.template).toBe("password-reset");
    expect(second?.code).toBeNull();
    expect(first?.id).not.toBe(second?.id);
  });

  it("list mengembalikan salinan", () => {
    const outbox = createEmailOutbox();
    outbox.add(message());

    const snapshot = outbox.list();
    outbox.add(message());

    expect(snapshot).toHaveLength(1);
    expect(outbox.list()).toHaveLength(2);
  });

  it(`hanya menyimpan ${OUTBOX_LIMIT} email terakhir`, () => {
    const outbox = createEmailOutbox();
    for (let index = 0; index <= OUTBOX_LIMIT; index += 1) {
      outbox.add(message({ idempotencyKey: `k/${index}` }));
    }

    const entries = outbox.list();
    expect(entries).toHaveLength(OUTBOX_LIMIT);
    expect(entries[0]?.idempotencyKey).toBe("k/1");
    expect(entries.at(-1)?.idempotencyKey).toBe(`k/${OUTBOX_LIMIT}`);
  });

  it("latestFor memilih email terakhir per alamat tanpa beda huruf", () => {
    const outbox = createEmailOutbox();
    outbox.add(message({ code: "111111" }));
    outbox.add(message({ code: "999999", to: "ani@example.com" }));
    outbox.add(message({ code: "222222" }));

    expect(outbox.latestFor("Budi@Example.com")?.code).toBe("222222");
    expect(outbox.latestFor("tidak-ada@example.com")).toBeUndefined();
  });

  it("clear(to) hanya menghapus email alamat itu; clear() semua", () => {
    const outbox = createEmailOutbox();
    outbox.add(message());
    outbox.add(message({ to: "ani@example.com" }));

    outbox.clear("BUDI@example.com");
    expect(outbox.list().map((entry) => entry.to)).toStrictEqual([
      "ani@example.com",
    ]);

    outbox.clear();
    expect(outbox.list()).toStrictEqual([]);
  });

  it("outbox terpisah tidak berbagi isi", () => {
    const first = createEmailOutbox();
    const second = createEmailOutbox();
    first.add(message());

    expect(second.list()).toStrictEqual([]);
  });
});

describe(createMemoryTransport, () => {
  it("send menambah ke outbox yang diberikan", async () => {
    const outbox = createEmailOutbox();

    await createMemoryTransport(outbox).send(message());

    expect(outbox.latestFor("budi@example.com")?.code).toBe("482913");
  });
});

describe(createLogTransport, () => {
  it("mencatat isi email dengan alamat disamarkan", async () => {
    const info =
      vi.fn<(text: string, properties?: Record<string, unknown>) => void>();

    await createLogTransport({ info }).send(message());

    expect(info).toHaveBeenCalledOnce();
    const [, properties] = info.mock.calls[0] ?? [];
    expect(properties).toMatchObject({
      recipient: "b***@example.com",
      subject: "Kode verifikasi email trush",
      template: "verification-otp",
      text: "Kode Anda 482913",
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain("budi@example.com");
  });

  it("html tidak ikut dicatat", async () => {
    const info =
      vi.fn<(text: string, properties?: Record<string, unknown>) => void>();

    await createLogTransport({ info }).send(
      message({ html: "<p>html-penanda</p>" })
    );

    expect(JSON.stringify(info.mock.calls)).not.toContain("html-penanda");
  });
});
