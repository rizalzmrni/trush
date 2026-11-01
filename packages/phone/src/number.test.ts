import { describe, expect, it } from "vitest";

import { PhoneError } from "./errors";
import { maskPhone, resolveRecipient, toE164 } from "./number";

const E164_ID = "+6281234567890";
const MY_NUMBER = "+60123456789";

const errorCodeOf = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    return error instanceof PhoneError ? error.code : "bukan PhoneError";
  }
  return undefined;
};

describe(toE164, () => {
  it.each([
    "0812-3456-7890",
    "0812 3456 7890",
    "081234567890",
    "+6281234567890",
    "+62 812-3456-7890",
    "  081234567890  ",
  ])("%s → +6281234567890 (default ID)", (input) => {
    expect(toE164(input, "ID")).toBe(E164_ID);
  });

  it("6281234567890 tanpa + juga dikenali sebagai +62", () => {
    expect(toE164("6281234567890", "ID")).toBe(E164_ID);
  });

  it.each(["abc", "", "0812", "12345", "+62 812"])(
    "%j → undefined",
    (input) => {
      expect(toE164(input, "ID")).toBeUndefined();
    }
  );

  it("nomor lokal mengikuti negara default yang diberikan", () => {
    expect(toE164("012-345 6789", "MY")).toBe(MY_NUMBER);
  });

  it("nomor lokal tanpa negara default (atau tidak dikenal) → undefined", () => {
    expect(toE164("081234567890", undefined)).toBeUndefined();
    expect(toE164("081234567890", "XX")).toBeUndefined();
  });

  it("nomor internasional tetap dikenali walau default ID", () => {
    expect(toE164(MY_NUMBER, "ID")).toBe(MY_NUMBER);
  });
});

const resolveNotAllowlisted = () =>
  resolveRecipient("081299998888", {
    allowedCountries: ["ID"],
    allowlist: [E164_ID],
  });

describe(resolveRecipient, () => {
  it("negara default = entri pertama allowedCountries", () => {
    expect(
      resolveRecipient("012-345 6789", { allowedCountries: ["MY", "ID"] })
    ).toBe(MY_NUMBER);
    expect(
      resolveRecipient("081234567890", { allowedCountries: ["ID", "MY"] })
    ).toBe(E164_ID);
  });

  it("nomor tidak valid → INVALID_NUMBER", () => {
    expect(
      errorCodeOf(() => resolveRecipient("abc", { allowedCountries: ["ID"] }))
    ).toBe("INVALID_NUMBER");
  });

  it("+60… dengan izin [ID] → UNSUPPORTED_DESTINATION", () => {
    expect(
      errorCodeOf(() =>
        resolveRecipient(MY_NUMBER, { allowedCountries: ["ID"] })
      )
    ).toBe("UNSUPPORTED_DESTINATION");
  });

  it("allowlist: nomor lain → NOT_ALLOWLISTED, nomor terdaftar lolos dalam bentuk apa pun", () => {
    const policy = { allowedCountries: ["ID"], allowlist: [E164_ID] };

    expect(errorCodeOf(() => resolveRecipient("081299998888", policy))).toBe(
      "NOT_ALLOWLISTED"
    );
    expect(resolveRecipient("0812-3456-7890", policy)).toBe(E164_ID);
  });

  it("pesan error tidak memuat nomor", () => {
    expect(resolveNotAllowlisted).toThrow(PhoneError);
    expect(resolveNotAllowlisted).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("99998888"),
      })
    );
  });
});

describe(maskPhone, () => {
  it("menyamarkan bagian tengah nomor", () => {
    expect(maskPhone(E164_ID)).toBe("+62812*****890");
  });

  it("tidak pernah mengembalikan nomor utuh", () => {
    for (const phone of [E164_ID, MY_NUMBER, "+12025550123"]) {
      expect(maskPhone(phone)).not.toBe(phone);
      expect(maskPhone(phone)).toHaveLength(phone.length);
    }
  });

  it("nomor pendek disamarkan seluruhnya", () => {
    expect(maskPhone("+12345")).toBe("******");
  });
});
