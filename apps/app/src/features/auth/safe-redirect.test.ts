import { describe, expect, it } from "vitest";

import {
  authPath,
  DEFAULT_REDIRECT,
  getSafeRedirect,
  redirectFromUrl,
  SIGN_IN_PATH,
  signInPath,
} from "./safe-redirect";

// Dirangkai agar lint `no-script-url` tidak membaca data uji sebagai tautan
// yang dieksekusi; nilainya tetap `javascript:alert(1)`.
const SCRIPT_URL = `${"javascript"}:alert(1)`;

const CONTROL_CHARS = /\p{Cc}/u;

// Path yang dinormalisasi parser URL menjadi `//host` (protocol-relative).
const DOT_SEGMENT_BYPASSES = [
  "/.//evil.example",
  "/a/..//evil.example",
  "/%2e//evil.example",
  "/%2e%2e//evil.example",
];

// Halaman auth dengan garis miring akhir / huruf besar: tetap cocok dengan
// route auth karena pencocokan React Router tidak peka keduanya.
const AUTH_PATH_VARIANTS = ["/sign-in/", "/sign-up/", "/sign-out/", "/SIGN-IN"];

describe(getSafeRedirect, () => {
  it.each([
    ["/", "/"],
    ["/settings", "/settings"],
    [
      "/org/acme/members?tab=invites#list",
      "/org/acme/members?tab=invites#list",
    ],
    ["/a/../b", "/b"],
  ])("menerima path internal %j", (input, expected) => {
    expect(getSafeRedirect(input)).toBe(expected);
  });

  it.each([
    ["URL absolut https", "https://evil.example/phish"],
    ["URL absolut http", "http://evil.example"],
    ["protocol-relative", "//evil.example"],
    ["protocol-relative dengan path", "//evil.example/sign-in"],
    ["backslash", "/\\evil.example"],
    ["backslash ganda", "\\\\evil.example"],
    ["tab di antara slash", "/\t/evil.example"],
    ["newline di antara slash", "/\n/evil.example"],
    ["backslash lalu slash", "/\\/evil.example"],
    ["skema javascript", SCRIPT_URL],
    ["skema javascript berhuruf besar", SCRIPT_URL.toUpperCase()],
    ["skema data", "data:text/html,<script>alert(1)</script>"],
    ["path relatif", "settings"],
    ["spasi di depan", " /settings"],
    ["string kosong", ""],
  ])("menolak %s", (_label, input) => {
    expect(getSafeRedirect(input)).toBe(DEFAULT_REDIRECT);
  });

  it.each([null, undefined, 42, {}, ["/settings"]])(
    "menolak nilai bukan string %j",
    (input) => {
      expect(getSafeRedirect(input)).toBe(DEFAULT_REDIRECT);
    }
  );

  it.each(["/sign-in", "/sign-up", "/sign-out", "/sign-in?redirectTo=/x"])(
    "menolak halaman auth %j (cegah putaran redirect)",
    (input) => {
      expect(getSafeRedirect(input)).toBe(DEFAULT_REDIRECT);
    }
  );

  it.each(DOT_SEGMENT_BYPASSES)(
    "menolak dot-segment yang menjadi protocol-relative %j",
    (input) => {
      expect(getSafeRedirect(input)).toBe(DEFAULT_REDIRECT);
    }
  );

  it.each(AUTH_PATH_VARIANTS)("menolak varian halaman auth %j", (input) => {
    expect(getSafeRedirect(input)).toBe(DEFAULT_REDIRECT);
  });

  it("memakai fallback yang diberikan", () => {
    expect(getSafeRedirect("https://evil.example", "/home")).toBe("/home");
    expect(getSafeRedirect(undefined, "/home")).toBe("/home");
  });

  it.each(["/\tevil", "/set\r\ntings", "/a\u0000b"])(
    "hasil untuk %j tetap path internal tanpa karakter kontrol",
    (input) => {
      const result = getSafeRedirect(input);
      expect(result.startsWith("/")).toBeTruthy();
      expect(result.startsWith("//")).toBeFalsy();
      expect(result).not.toMatch(CONTROL_CHARS);
    }
  );
});

describe(signInPath, () => {
  it("tanpa redirectTo untuk tujuan bawaan", () => {
    expect(signInPath()).toBe(SIGN_IN_PATH);
    expect(signInPath("/")).toBe(SIGN_IN_PATH);
  });

  it("membawa redirectTo internal yang ter-encode", () => {
    const path = signInPath("/settings?tab=profile");
    const url = new URL(path, "https://app.example.test");
    expect(url.pathname).toBe(SIGN_IN_PATH);
    expect(url.searchParams.get("redirectTo")).toBe("/settings?tab=profile");
  });

  it("membuang redirectTo eksternal", () => {
    expect(signInPath("//evil.example")).toBe(SIGN_IN_PATH);
  });
});

describe(redirectFromUrl, () => {
  it("membaca dan menyaring query redirectTo", () => {
    expect(
      redirectFromUrl("https://app.example.test/sign-in?redirectTo=%2Fbilling")
    ).toBe("/billing");
    expect(
      redirectFromUrl(
        "https://app.example.test/sign-in?redirectTo=https%3A%2F%2Fevil.example"
      )
    ).toBe(DEFAULT_REDIRECT);
    expect(redirectFromUrl("https://app.example.test/sign-in")).toBe(
      DEFAULT_REDIRECT
    );
  });
});

describe("halaman auth email (B15) bukan tujuan redirect", () => {
  it.each([
    "/verify-email",
    "/verify-email?email=a%40b.test",
    "/forgot-password",
    "/reset-password?token=abc",
    "/Reset-Password/",
    "/VERIFY-EMAIL//",
  ])("menolak %j", (input) => {
    expect(getSafeRedirect(input)).toBe(DEFAULT_REDIRECT);
  });

  it("path yang hanya berawalan sama tetap diterima", () => {
    expect(getSafeRedirect("/verify-email-settings")).toBe(
      "/verify-email-settings"
    );
  });
});

describe(authPath, () => {
  it("tanpa query dan redirectTo bawaan → path saja", () => {
    expect(authPath("/verify-email")).toBe("/verify-email");
    expect(authPath("/verify-email", "/")).toBe("/verify-email");
  });

  it("query kosong/undefined dibuang; nilai di-encode", () => {
    expect(
      authPath("/sign-in", undefined, {
        email: "budi+uji@example.test",
        notice: undefined,
        reason: "",
      })
    ).toBe("/sign-in?email=budi%2Buji%40example.test");
  });

  it("redirectTo internal ikut setelah query", () => {
    expect(
      authPath("/sign-in", "/org/acme?tab=1", { notice: "email-verified" })
    ).toBe("/sign-in?notice=email-verified&redirectTo=%2Forg%2Facme%3Ftab%3D1");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/sign-up",
    "/reset-password",
  ])("redirectTo %j disaring → tidak ikut", (redirectTo) => {
    expect(authPath("/sign-in", redirectTo, { notice: "password-reset" })).toBe(
      "/sign-in?notice=password-reset"
    );
  });

  it("query redirectTo tidak bisa menimpa redirectTo tersaring", () => {
    expect(
      authPath("/sign-in", "/billing", { redirectTo: "https://evil.example" })
    ).toBe("/sign-in?redirectTo=%2Fbilling");
  });
});
