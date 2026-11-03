import { describe, expect, it } from "vitest";

import { AUTH_NOTICES, noticeFromUrl } from "./notices";

const url = (query: string) => `https://app.example.test/sign-in${query}`;

describe(noticeFromUrl, () => {
  it.each(Object.values(AUTH_NOTICES))("notice %s → pesan sukses", (notice) => {
    expect(noticeFromUrl(url(`?notice=${notice}`))).toStrictEqual(
      expect.stringMatching(/berhasil/u)
    );
  });

  it("pesan verifikasi dan reset berbeda", () => {
    expect(noticeFromUrl(url("?notice=email-verified"))).not.toBe(
      noticeFromUrl(url("?notice=password-reset"))
    );
  });

  it.each([
    "",
    "?notice=",
    "?notice=Akun%20Anda%20diblokir",
    "?notice=toString",
    "?notice=__proto__",
    "?notice=EMAIL-VERIFIED",
  ])("query %j → undefined (teks tidak pernah dari URL)", (query) => {
    expect(noticeFromUrl(url(query))).toBeUndefined();
  });
});
