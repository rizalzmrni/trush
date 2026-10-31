import { describe, expect, it } from "vitest";

import {
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

  // BUG: dot-segment sebelum `//` lolos cek awal lalu dinormalisasi URL menjadi `//evil.example` (open redirect).
  it.fails.each(DOT_SEGMENT_BYPASSES)(
    "menolak dot-segment yang menjadi protocol-relative %j",
    (input) => {
      expect(getSafeRedirect(input)).toBe(DEFAULT_REDIRECT);
    }
  );

  // BUG: halaman auth dengan garis miring akhir / huruf besar tidak dikenali sebagai halaman auth.
  it.fails.each(AUTH_PATH_VARIANTS)(
    "menolak varian halaman auth %j",
    (input) => {
      expect(getSafeRedirect(input)).toBe(DEFAULT_REDIRECT);
    }
  );

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
