import { describe, expect, it } from "vitest";

import { maskEmail, normalizeEmail, resolveRecipient } from "./address";
import { EmailError } from "./errors";

// Alamat palsu.
const ADDRESS = "budi@example.com";

const errorOf = (run: () => unknown): EmailError => {
  try {
    run();
  } catch (error) {
    if (error instanceof EmailError) {
      return error;
    }
    throw error;
  }
  throw new Error("diharapkan melempar EmailError");
};

describe(normalizeEmail, () => {
  it("memangkas spasi dan menjadikan huruf kecil", () => {
    expect(normalizeEmail("  Budi@Example.COM ")).toBe(ADDRESS);
  });

  it.each([
    "",
    "budi",
    "budi@",
    "@example.com",
    "budi@example",
    "bu di@example.com",
    "Budi <budi@example.com>",
  ])("%j tidak valid → undefined", (input) => {
    expect(normalizeEmail(input)).toBeUndefined();
  });
});

describe(maskEmail, () => {
  it("menyisakan huruf pertama dan domain", () => {
    expect(maskEmail(ADDRESS)).toBe("b***@example.com");
  });

  it("bagian lokal panjang tidak bocor", () => {
    const masked = maskEmail("rahasia.sekali@example.com");

    expect(masked).toBe("r***@example.com");
    expect(masked).not.toContain("rahasia");
  });

  it.each(["tanpa-at", "@example.com", ""])(
    "%j tanpa bagian lokal → ***",
    (input) => {
      expect(maskEmail(input)).toBe("***");
    }
  );
});

describe(resolveRecipient, () => {
  it.each([undefined, []])(
    "allowlist %j → semua alamat valid diterima, dinormalisasi",
    (allowlist) => {
      expect(
        resolveRecipient(" Budi@Example.com", { EMAIL_ALLOWLIST: allowlist })
      ).toBe(ADDRESS);
    }
  );

  it("alamat persis di allowlist diterima", () => {
    expect(
      resolveRecipient("BUDI@example.com", { EMAIL_ALLOWLIST: [ADDRESS] })
    ).toBe(ADDRESS);
  });

  it("@domain di allowlist menerima semua alamat domain itu", () => {
    expect(
      resolveRecipient("siapa@example.com", {
        EMAIL_ALLOWLIST: ["@example.com"],
      })
    ).toBe("siapa@example.com");
  });

  it.each([
    "budi@mail.example.com",
    "budi@example.com.evil.test",
    "budi@evil.test",
  ])(
    "%s di luar allowlist @example.com ditolak NOT_ALLOWLISTED tanpa alamat di pesan",
    (address) => {
      const error = errorOf(() =>
        resolveRecipient(address, { EMAIL_ALLOWLIST: ["@example.com"] })
      );

      expect(error.code).toBe("NOT_ALLOWLISTED");
      expect(error.message).not.toContain(address);
    }
  );

  it("alamat tidak valid ditolak INVALID_ADDRESS tanpa alamat di pesan", () => {
    const error = errorOf(() =>
      resolveRecipient("rahasia@", { EMAIL_ALLOWLIST: undefined })
    );

    expect(error.code).toBe("INVALID_ADDRESS");
    expect(error.message).not.toContain("rahasia");
  });
});
