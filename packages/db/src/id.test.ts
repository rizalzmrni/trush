import { afterEach, describe, expect, it, vi } from "vitest";

import { newId } from "./id";

// Versi 7 di nibble ke-13, variant RFC 9562 (8, 9, a, b) di nibble ke-17.
const UUID_V7 =
  /^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u;
const ITERATIONS = 5000;
const UNIX_MS_HEX_LENGTH = 12;

const timestampOf = (id: string): number =>
  Number.parseInt(id.replaceAll("-", "").slice(0, UNIX_MS_HEX_LENGTH), 16);

const sortedCopy = (ids: readonly string[]): string[] =>
  ids.toSorted((a, b) => {
    if (a < b) {
      return -1;
    }
    return a > b ? 1 : 0;
  });

describe(newId, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("menghasilkan UUIDv7 huruf kecil", () => {
    const id = newId();

    expect(id).toMatch(UUID_V7);
  });

  it("bukan UUIDv4 seperti crypto.randomUUID()", () => {
    expect(newId()[14]).toBe("7");
  });

  it("unik dalam banyak pemanggilan", () => {
    const ids = Array.from({ length: ITERATIONS }, () => newId());

    expect(new Set(ids).size).toBe(ITERATIONS);
    for (const id of ids) {
      expect(id).toMatch(UUID_V7);
    }
  });

  it("urutan string sama dengan urutan pembuatan dalam milidetik yang sama", () => {
    vi.useFakeTimers({ now: new Date("2026-10-31T00:00:00.000Z") });
    const ids = Array.from({ length: ITERATIONS }, () => newId());

    expect(sortedCopy(ids)).toStrictEqual(ids);
  });

  it("urutan string sama dengan urutan pembuatan lintas milidetik", () => {
    vi.useFakeTimers({ now: new Date("2026-10-31T00:00:00.000Z") });
    const ids: string[] = [];
    for (let step = 0; step < 50; step += 1) {
      ids.push(newId(), newId());
      vi.advanceTimersByTime(step % 2 === 0 ? 1 : 1000);
    }

    expect(sortedCopy(ids)).toStrictEqual(ids);
  });

  it("menyandikan waktu pembuatan (unix ms) di 48 bit pertama", () => {
    const now = new Date("2027-01-02T03:04:05.678Z");
    vi.useFakeTimers({ now });

    expect(timestampOf(newId())).toBe(now.getTime());
  });
});
