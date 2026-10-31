import { createHash } from "node:crypto";

import { createTestDb } from "@trush/db/testing";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_BASE_PATH, CAPTCHA_ENDPOINTS, createAuth } from "./auth";
import type { AuthEnv } from "./auth";

// Semua nilai palsu. Turnstile memakai kunci uji Cloudflare.
const PASS_SECRET = "1x0000000000000000000000000000000AA";
const FAIL_SECRET = "2x0000000000000000000000000000000AA";
const CAPTCHA_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const ORIGIN = "http://localhost:5173";
const SESSION_COOKIE = "__Secure-better-auth.session_token";
const PASSWORD = "kata-sandi-uji-yang-cukup-panjang-42";
const PWNED_PASSWORD = "password-bocor-di-daftar-mock-1";
const UUID_V7 =
  /^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u;
const SIGN_IN_LIMIT = 5;
const HTTP_TOO_MANY_REQUESTS = 429;

const BASE_ENV: AuthEnv = {
  APP_ENV: "development",
  AUTH_COOKIE_DOMAIN: undefined,
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:8787",
  CORS_ORIGINS: [ORIGIN],
  TURNSTILE_SECRET_KEY: PASS_SECRET,
};

const sha1 = (value: string): string =>
  createHash("sha1").update(value).digest("hex").toUpperCase();

const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status });

/**
 * Pengganti `fetch` keluar: Turnstile lolos untuk secret `1x…` dan gagal untuk
 * `2x…` (meniru kunci uji Cloudflare); HIBP hanya mengenal `PWNED_PASSWORD`.
 * Host lain melempar agar test tidak pernah menyentuh jaringan nyata.
 */
const fakeResponse = (
  input: RequestInfo | URL,
  init?: RequestInit
): Response => {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  if (url.hostname === "challenges.cloudflare.com") {
    const body: unknown = JSON.parse(String(init?.body ?? "{}"));
    const secret =
      typeof body === "object" && body !== null && "secret" in body
        ? String(body.secret)
        : "";
    return secret.startsWith("1x")
      ? json({ success: true })
      : json({ "error-codes": ["invalid-input-response"], success: false });
  }
  if (url.hostname === "api.pwnedpasswords.com") {
    const prefix = url.pathname.split("/").at(-1) ?? "";
    const pwned = sha1(PWNED_PASSWORD);
    const lines = ["0000000000000000000000000000000000A:0"];
    if (pwned.startsWith(prefix)) {
      lines.push(`${pwned.slice(prefix.length)}:12345`);
    }
    return new Response(lines.join("\r\n"));
  }
  throw new Error(`fetch tak terduga ke ${url.href}`);
};

const fakeFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => Promise.resolve(fakeResponse(input, init));

type TestDbHandle = Awaited<ReturnType<typeof createTestDb>>;

let handle: TestDbHandle;
let ipCounter = 0;

const nextIp = (): string => {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
};

const makeAuth = (env: Partial<AuthEnv> = {}) =>
  createAuth({ db: handle.db, env: { ...BASE_ENV, ...env } });

type TestAuth = ReturnType<typeof makeAuth>;

interface PostOptions {
  body?: unknown;
  captcha?: boolean;
  cookie?: string;
  ip?: string;
}

const post = (
  auth: TestAuth,
  path: string,
  { body = {}, captcha = true, cookie, ip = nextIp() }: PostOptions = {}
): Promise<Response> => {
  const headers = new Headers({
    "cf-connecting-ip": ip,
    "content-type": "application/json",
    origin: ORIGIN,
  });
  if (captcha) {
    headers.set("x-captcha-response", CAPTCHA_TOKEN);
  }
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return auth.handler(
    new Request(`${BASE_ENV.BETTER_AUTH_URL}${AUTH_BASE_PATH}${path}`, {
      body: JSON.stringify(body),
      headers,
      method: "POST",
    })
  );
};

/** Nilai `name=value` cookie sesi dari `Set-Cookie`, siap dikirim balik. */
const sessionCookieOf = (response: Response): string => {
  const raw = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (!raw) {
    throw new Error("cookie sesi tidak di-set");
  }
  return raw.split(";")[0] ?? "";
};

const sessionSetCookie = (response: Response): string =>
  response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`)) ?? "";

let emailCounter = 0;
const nextEmail = (): string => {
  emailCounter += 1;
  return `pengguna-${emailCounter}@example.test`;
};

const signUp = (auth: TestAuth, email = nextEmail(), password = PASSWORD) =>
  post(auth, "/sign-up/email", {
    body: { email, name: "Pengguna Uji", password },
  });

const getSession = (auth: TestAuth, cookie: string) =>
  auth.api.getSession({ headers: new Headers({ cookie }) });

/**
 * Sign-in gagal berturut-turut dari satu IP (`SIGN_IN_LIMIT` + 1 kali).
 * Berurutan, bukan paralel, agar hitungan rate limit deterministik.
 */
const signInBurst = async (
  auth: TestAuth,
  ip = nextIp(),
  statuses: number[] = []
): Promise<number[]> => {
  if (statuses.length > SIGN_IN_LIMIT) {
    return statuses;
  }
  const response = await post(auth, "/sign-in/email", {
    body: { email: "tidak-ada@example.test", password: PASSWORD },
    ip,
  });
  statuses.push(response.status);
  return signInBurst(auth, ip, statuses);
};

describe(createAuth, () => {
  beforeEach(async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(fakeFetch);
    handle = await createTestDb();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await handle.close();
  });

  describe("sesi", () => {
    it("sign-up membuat user dan sesi yang tervalidasi lewat cookie", async () => {
      const auth = makeAuth();
      const email = nextEmail();

      const response = await signUp(auth, email);

      expect(response.status).toBe(200);

      const result = await getSession(auth, sessionCookieOf(response));

      expect(result?.user.email).toBe(email);
      expect(result?.session.userId).toBe(result?.user.id);
    });

    it("sign-in email membuat sesi baru", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUp(auth, email);

      const response = await post(auth, "/sign-in/email", {
        body: { email, password: PASSWORD },
      });

      expect(response.status).toBe(200);
      await expect(
        getSession(auth, sessionCookieOf(response))
      ).resolves.toMatchObject({ user: { email } });
    });

    it("sign-in dengan password salah ditolak tanpa cookie sesi", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUp(auth, email);

      const response = await post(auth, "/sign-in/email", {
        body: { email, password: "salah-sama-sekali-123" },
      });

      expect(response.status).toBe(401);
      expect(sessionSetCookie(response)).toBe("");
    });

    it("getSession tanpa cookie atau dengan token palsu → null", async () => {
      const auth = makeAuth();

      await expect(
        auth.api.getSession({ headers: new Headers() })
      ).resolves.toBeNull();
      await expect(
        getSession(auth, `${SESSION_COOKIE}=token-palsu.tanda-tangan-palsu`)
      ).resolves.toBeNull();
    });

    it("sesi kedaluwarsa → null", async () => {
      const auth = makeAuth();
      const cookie = sessionCookieOf(await signUp(auth));

      await handle.db.execute(
        sql`update "session" set expires_at = now() - interval '1 minute'`
      );

      await expect(getSession(auth, cookie)).resolves.toBeNull();
    });

    it("cookie ditandatangani secret: secret lain menolak cookie yang sama", async () => {
      const cookie = sessionCookieOf(await signUp(makeAuth()));
      const other = makeAuth({
        BETTER_AUTH_SECRET: "secret-lain-0123456789abcdef0123456789abcdef",
      });

      await expect(getSession(other, cookie)).resolves.toBeNull();
    });
  });

  describe("ID UUIDv7", () => {
    it("id user, sesi, dan organisasi berformat UUIDv7", async () => {
      const auth = makeAuth();
      const cookie = sessionCookieOf(await signUp(auth));

      const created = await post(auth, "/organization/create", {
        body: { name: "Toko Uji", slug: "toko-uji" },
        cookie,
      });

      const session = await getSession(auth, cookie);
      const org: unknown = await created.json();

      const members = await handle.db.execute<{ id: string }>(
        sql`select id from "member"`
      );

      expect(session?.user.id).toMatch(UUID_V7);
      expect(session?.session.id).toMatch(UUID_V7);
      expect(org).toMatchObject({ id: expect.stringMatching(UUID_V7) });
      expect(members.rows.map((row) => row.id)).toStrictEqual([
        expect.stringMatching(UUID_V7),
      ]);
    });
  });

  describe("atribut cookie sesi", () => {
    it("__Secure-, HttpOnly, Secure, SameSite=Lax, tanpa Domain secara default", async () => {
      const setCookie = sessionSetCookie(await signUp(makeAuth()));
      const attributes = setCookie.toLowerCase();

      expect(setCookie.startsWith(`${SESSION_COOKIE}=`)).toBeTruthy();
      expect(attributes).toContain("httponly");
      expect(attributes).toContain("secure");
      expect(attributes).toContain("samesite=lax");
      expect(attributes).not.toContain("domain=");
    });

    it("Domain hanya dipasang bila AUTH_COOKIE_DOMAIN diisi", async () => {
      const setCookie = sessionSetCookie(
        await signUp(makeAuth({ AUTH_COOKIE_DOMAIN: "example.com" }))
      );

      expect(setCookie.toLowerCase()).toContain("domain=example.com");
      expect(setCookie.toLowerCase()).toContain("httponly");
    });
  });

  describe("plugin aktif", () => {
    it("persis daftar izin B6", () => {
      const ids = (makeAuth().options.plugins ?? []).map((plugin) => plugin.id);

      expect(ids.toSorted()).toStrictEqual(
        [
          "admin",
          "captcha",
          "have-i-been-pwned",
          "last-login-method",
          "multi-session",
          "open-api",
          "organization",
          "two-factor",
          "username",
        ].toSorted()
      );
    });
  });

  describe("captcha (Turnstile)", () => {
    it.each(CAPTCHA_ENDPOINTS)(
      "%s → 400 tanpa header x-captcha-response",
      async (path) => {
        const response = await post(makeAuth(), path, {
          body: { email: nextEmail(), password: PASSWORD },
          captcha: false,
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
          code: "MISSING_RESPONSE",
        });
      }
    );

    it.each(CAPTCHA_ENDPOINTS)(
      "%s → 403 dengan secret uji 2x…",
      async (path) => {
        const response = await post(
          makeAuth({ TURNSTILE_SECRET_KEY: FAIL_SECRET }),
          path,
          { body: { email: nextEmail(), password: PASSWORD } }
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
          code: "VERIFICATION_FAILED",
        });
      }
    );

    it("sign-up gagal captcha tidak membuat user", async () => {
      await post(
        makeAuth({ TURNSTILE_SECRET_KEY: FAIL_SECRET }),
        "/sign-up/email",
        {
          body: { email: nextEmail(), name: "X", password: PASSWORD },
        }
      );

      const users = await handle.db.execute<{ total: number }>(
        sql`select count(*)::int as total from "user"`
      );

      expect(users.rows).toStrictEqual([{ total: 0 }]);
    });

    it("endpoint di luar daftar tidak meminta captcha", async () => {
      const auth = makeAuth();
      const cookie = sessionCookieOf(await signUp(auth));

      const response = await post(auth, "/sign-out", {
        captcha: false,
        cookie,
      });

      expect(response.status).toBe(200);
    });
  });

  describe("haveIBeenPwned", () => {
    it("menolak password yang ada di daftar bocor", async () => {
      const response = await signUp(makeAuth(), nextEmail(), PWNED_PASSWORD);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: "PASSWORD_COMPROMISED",
      });
    });

    it("hanya 5 karakter awal hash yang dikirim ke HIBP", async () => {
      await signUp(makeAuth(), nextEmail(), PWNED_PASSWORD);

      const hibpCalls = vi
        .mocked(globalThis.fetch)
        .mock.calls.map(([input]) =>
          String(input instanceof Request ? input.url : input)
        )
        .filter((url) => url.includes("pwnedpasswords"));

      expect(hibpCalls).toStrictEqual([
        `https://api.pwnedpasswords.com/range/${sha1(PWNED_PASSWORD).slice(0, 5)}`,
      ]);
    });
  });

  describe("rate limit /sign-in/*", () => {
    it("aktif saat APP_ENV=staging: percobaan ke-6 → 429", async () => {
      const statuses = await signInBurst(makeAuth({ APP_ENV: "staging" }));

      expect(statuses.slice(0, SIGN_IN_LIMIT)).not.toContain(
        HTTP_TOO_MANY_REQUESTS
      );
      expect(statuses.at(-1)).toBe(HTTP_TOO_MANY_REQUESTS);
    });

    it("hitungan per IP: IP lain tidak ikut terblokir", async () => {
      const auth = makeAuth({ APP_ENV: "staging" });
      await signInBurst(auth);

      const response = await post(auth, "/sign-in/email", {
        body: { email: "tidak-ada@example.test", password: PASSWORD },
      });

      expect(response.status).not.toBe(HTTP_TOO_MANY_REQUESTS);
    });

    it("mati saat APP_ENV=development", async () => {
      const statuses = await signInBurst(makeAuth({ APP_ENV: "development" }));

      expect(statuses).not.toContain(HTTP_TOO_MANY_REQUESTS);
    });
  });
});
