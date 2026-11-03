import { describe, expect, it } from "vitest";

import {
  emailFromQuery,
  isVerifyEmailIntent,
  reasonNotice,
  VERIFY_EMAIL_INTENTS,
  VERIFY_REASONS,
} from "./form-schema";

describe(emailFromQuery, () => {
  it("dipangkas dan huruf kecil seperti server", () => {
    expect(emailFromQuery("  Budi@Example.TEST ")).toBe("budi@example.test");
  });

  it.each([null, "", "bukan-email", "<script>@x", "budi@"])(
    "%j → undefined",
    (value) => {
      expect(emailFromQuery(value)).toBeUndefined();
    }
  );
});

describe(reasonNotice, () => {
  it.each(Object.values(VERIFY_REASONS))("reason %s → pesan", (reason) => {
    expect(reasonNotice(reason)).toStrictEqual(expect.any(String));
  });

  it.each([null, "", "lainnya", "toString", "__proto__"])(
    "%j → undefined (teks tidak dari URL)",
    (value) => {
      expect(reasonNotice(value)).toBeUndefined();
    }
  );
});

describe(isVerifyEmailIntent, () => {
  it.each(Object.values(VERIFY_EMAIL_INTENTS))("%s dikenal", (intent) => {
    expect(isVerifyEmailIntent(intent)).toBeTruthy();
  });

  it.each([null, undefined, "", "delete", 1])("%j ditolak", (value) => {
    expect(isVerifyEmailIntent(value)).toBeFalsy();
  });
});
