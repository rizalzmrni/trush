import { describe, expect, it } from "vitest";

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTime,
} from "./format";

// Intl memakai spasi tak-putus (U+00A0 / U+202F); samakan agar assertion terbaca.
const WHITESPACE = /\s/gu;
const normalize = (value: string): string => value.replaceAll(WHITESPACE, " ");

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = new Date("2026-10-31T12:00:00Z");
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);
const ahead = (ms: number): Date => new Date(NOW.getTime() + ms);

// 23.30 UTC: sudah tanggal berikutnya di WIB (UTC+7) dan WITA (UTC+8).
const LATE_UTC = "2026-01-15T23:30:00Z";

describe("format angka", () => {
  it("memakai pemisah id-ID", () => {
    expect(formatNumber(1_234_567.891)).toBe("1.234.567,891");
  });

  it("menerima opsi Intl", () => {
    expect(formatNumber(1.5, { minimumFractionDigits: 2 })).toBe("1,50");
  });

  it("locale lain bisa dipilih", () => {
    expect(formatNumber(1234.5, { locale: "en-US" })).toBe("1,234.5");
  });

  it("persen dari pecahan dengan maksimal satu desimal", () => {
    expect(formatPercent(0.25)).toBe("25%");
    expect(formatPercent(0.2555)).toBe("25,6%");
  });
});

describe("format mata uang", () => {
  it("Rupiah tanpa desimal secara default", () => {
    expect(normalize(formatCurrency(1_500_000))).toBe("Rp 1.500.000");
    expect(normalize(formatCurrency(1_500_000.75))).toBe("Rp 1.500.001");
  });

  it("nilai negatif", () => {
    expect(normalize(formatCurrency(-2500))).toBe("-Rp 2.500");
  });

  it("mata uang lain memakai desimal standar Intl", () => {
    expect(normalize(formatCurrency(12.5, { currency: "USD" }))).toBe(
      "US$12,50"
    );
  });

  it("opsi pemanggil menimpa default Rupiah", () => {
    expect(
      normalize(
        formatCurrency(1500.5, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        })
      )
    ).toBe("Rp 1.500,50");
  });

  it("IDR dengan minimumFractionDigits saja menampilkan desimal", () => {
    expect(
      normalize(formatCurrency(1500.5, { minimumFractionDigits: 2 }))
    ).toBe("Rp 1.500,50");
  });
});

describe("format tanggal dan waktu", () => {
  it("tanggal mengikuti zona waktu yang diberikan", () => {
    expect(formatDate(LATE_UTC, { timeZone: "UTC" })).toBe("15 Jan 2026");
    expect(formatDate(LATE_UTC, { timeZone: "Asia/Jakarta" })).toBe(
      "16 Jan 2026"
    );
  });

  it("zona waktu berbeda tidak tertukar oleh cache formatter", () => {
    const jakarta = formatDateTime(LATE_UTC, { timeZone: "Asia/Jakarta" });
    const utc = formatDateTime(LATE_UTC, { timeZone: "UTC" });

    expect(normalize(jakarta)).toBe("16 Jan 2026, 06.30");
    expect(normalize(utc)).toBe("15 Jan 2026, 23.30");
  });

  it("waktu memakai format 24 jam id-ID", () => {
    expect(formatTime(LATE_UTC, { timeZone: "Asia/Makassar" })).toBe("07.30");
    expect(formatTime(LATE_UTC, { timeZone: "Asia/Jayapura" })).toBe("08.30");
  });

  it("menerima Date, timestamp, dan string ISO", () => {
    const date = new Date(LATE_UTC);
    const expected = formatDate(LATE_UTC, { timeZone: "UTC" });

    expect(formatDate(date, { timeZone: "UTC" })).toBe(expected);
    expect(formatDate(date.getTime(), { timeZone: "UTC" })).toBe(expected);
  });

  it("opsi Intl menimpa gaya default", () => {
    expect(
      formatDate(LATE_UTC, { dateStyle: "full", timeZone: "Asia/Jakarta" })
    ).toBe("Jumat, 16 Januari 2026");
  });
});

describe("format waktu relatif", () => {
  it.each([
    [ago(30 * SECOND), "30 detik yang lalu"],
    [ago(45 * MINUTE), "45 menit yang lalu"],
    [ahead(2 * HOUR), "dalam 2 jam"],
    [ago(DAY), "kemarin"],
    [ago(3 * DAY), "3 hari yang lalu"],
    [ago(2 * 365 * DAY), "2 tahun yang lalu"],
    [NOW, "sekarang"],
  ])("%s menjadi %s", (value, expected) => {
    expect(formatRelativeTime(value, { now: NOW })).toBe(expected);
  });

  it("now bisa berupa string atau timestamp", () => {
    const value = ago(3 * DAY);

    expect(formatRelativeTime(value, { now: NOW.toISOString() })).toBe(
      "3 hari yang lalu"
    );
    expect(formatRelativeTime(value, { now: NOW.getTime() })).toBe(
      "3 hari yang lalu"
    );
  });

  it("locale lain bisa dipilih", () => {
    expect(
      formatRelativeTime(ago(3 * DAY), { locale: "en-US", now: NOW })
    ).toBe("3 days ago");
  });
});
