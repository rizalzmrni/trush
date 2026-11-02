import { createTestDb } from "@trush/db/testing";
import { createEmailOutbox, createEmailSender } from "@trush/email";
import type { EmailOutbox } from "@trush/email";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_BASE_PATH, createAuth } from "./auth";
import type { AuthEnv } from "./auth";
import { markEmailVerified, TEST_EMAIL_ENV } from "./testing";

// Semua nilai palsu; email driver memory, fetch keluar di-mock.
const APP_ORIGIN = TEST_EMAIL_ENV.APP_URL;
const PENDING_COOKIE = "__Secure-better-auth.email_pending";
const PASSWORD = "kata-sandi-pendaftar-yang-panjang-42";
const ATTACKER_PASSWORD = "kata-sandi-penyerang-yang-panjang-66";
const NEW_PASSWORD = "kata-sandi-baru-pemilik-email-88";
const ATTACKER_PHONE = "+6281211112222";
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;

const BASE_ENV: AuthEnv = {
  ...TEST_EMAIL_ENV,
  APP_ENV: "development",
  AUTH_COOKIE_DOMAIN: undefined,
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:8787",
  // APP_URL wajib ada di sini agar tautan "buat kata sandi" bisa dibuka.
  CORS_ORIGINS: [APP_ORIGIN],
  PHONE_ALLOWED_COUNTRIES: ["ID"],
  PHONE_ALLOWLIST: undefined,
  PHONE_DRIVER: "memory",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  TWILIO_ACCOUNT_SID: undefined,
  TWILIO_API_KEY_SECRET: undefined,
  TWILIO_API_KEY_SID: undefined,
  TWILIO_MESSAGING_SERVICE_SID: undefined,
  TWILIO_TEST_ACCOUNT_SID: undefined,
  TWILIO_TEST_AUTH_TOKEN: undefined,
  TWILIO_WHATSAPP_OTP_CONTENT_SID: undefined,
};

/** Turnstile selalu lolos; HIBP tidak mengenal password apa pun. */
const fakeFetch = (input: RequestInfo | URL): Promise<Response> => {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  if (url.hostname === "challenges.cloudflare.com") {
    return Promise.resolve(Response.json({ success: true }));
  }
  if (url.hostname === "api.pwnedpasswords.com") {
    return Promise.resolve(
      new Response("0000000000000000000000000000000000A:0")
    );
  }
  return Promise.reject(new Error(`fetch tak terduga ke ${url.href}`));
};

let ipCounter = 0;
const nextIp = (): string => {
  ipCounter += 1;
  return `198.51.100.${ipCounter % 250}`;
};

let emailCounter = 0;
const nextEmail = (): string => {
  emailCounter += 1;
  return `korban-${emailCounter}@example.test`;
};

type TestAuth = ReturnType<typeof createAuth>;

const post = (
  auth: TestAuth,
  path: string,
  body: unknown,
  cookie?: string
): Promise<Response> => {
  const headers = new Headers({
    "cf-connecting-ip": nextIp(),
    "content-type": "application/json",
    origin: APP_ORIGIN,
    "x-captcha-response": "XXXX.DUMMY.TOKEN.XXXX",
  });
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

/** `Set-Cookie` email_pending dari respons, atau `undefined`. */
const pendingSetCookie = (response: Response): string | undefined =>
  response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${PENDING_COOKIE}=`));

/** Cookie email_pending siap dikirim balik (`name=value`). */
const pendingCookieOf = (response: Response): string => {
  const raw = pendingSetCookie(response);
  if (!raw) {
    throw new Error(
      `cookie email_pending tidak di-set (HTTP ${response.status})`
    );
  }
  return raw.split(";")[0] ?? "";
};

const signUp = (auth: TestAuth, email: string, password = PASSWORD) =>
  post(auth, "/sign-up/email", { email, name: "Pendaftar", password });

const signIn = (auth: TestAuth, email: string, password = PASSWORD) =>
  post(auth, "/sign-in/email", { email, password });

/** Status login email + kata sandi. */
const signInStatus = async (
  auth: TestAuth,
  email: string,
  password = PASSWORD
): Promise<number> => {
  const { status } = await signIn(auth, email, password);
  return status;
};

const verify = (auth: TestAuth, email: string, otp: string, cookie?: string) =>
  post(auth, "/email-otp/verify-email", { email, otp }, cookie);

describe("pra-pembajakan akun lewat verifikasi email (B19)", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;
  let outbox: EmailOutbox;

  const makeAuth = () =>
    createAuth({
      db: handle.db,
      emailSender: createEmailSender({ env: BASE_ENV, outbox }),
      env: BASE_ENV,
    });

  const latestCode = (email: string): string => {
    const code = outbox.latestFor(email)?.code;
    if (!code) {
      throw new Error("kode verifikasi tidak ada di outbox");
    }
    return code;
  };

  const userIdOf = async (email: string): Promise<string> => {
    const result = await handle.db.execute<{ id: string }>(
      sql`select id from "user" where email = ${email}`
    );
    const id = result.rows[0]?.id;
    if (!id) {
      throw new Error("pengguna tidak ditemukan");
    }
    return id;
  };

  /** Jumlah baris akun (credential) dan sesi, serta status telepon pengguna. */
  const accessOf = async (userId: string) => {
    const result = await handle.db.execute<{
      accounts: number;
      phone: string | null;
      phoneVerified: boolean | null;
      sessions: number;
    }>(
      sql`select
        (select count(*)::int from "account" where user_id = ${userId}) as accounts,
        (select count(*)::int from "session" where user_id = ${userId}) as sessions,
        phone_number as phone,
        phone_number_verified as "phoneVerified"
      from "user" where id = ${userId}`
    );
    return result.rows[0];
  };

  /**
   * Penyerang mendaftar dengan email korban (cookie-nya dibuang), lalu
   * menyiapkan sesi + nomor telepon miliknya pada akun itu (lewat DB; jalur
   * normal tidak bisa login sebelum verifikasi).
   */
  const preHijack = async (auth: TestAuth, email: string): Promise<string> => {
    await signUp(auth, email, ATTACKER_PASSWORD);
    const userId = await userIdOf(email);
    const context = await auth.$context;
    await context.internalAdapter.createSession(userId);
    await handle.db.execute(
      sql`update "user" set phone_number = ${ATTACKER_PHONE}, phone_number_verified = true where id = ${userId}`
    );
    return userId;
  };

  /** Tautan email `password-reset` terbaru untuk `email`. */
  const setupLinkFor = (email: string): string => {
    const entry = outbox.latestFor(email);
    const link = entry?.body.match(/https?:\/\/\S+\/reset-password\/\S+/u)?.[0];
    if (entry?.template !== "password-reset" || !link) {
      throw new Error("tautan buat kata sandi tidak ada di outbox");
    }
    return link;
  };

  beforeEach(async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(fakeFetch);
    handle = await createTestDb();
    outbox = createEmailOutbox();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await handle.close();
  });

  describe("cookie bukti kata sandi", () => {
    it("sign-up sukses memasang cookie email_pending (HttpOnly, Secure, 1 jam)", async () => {
      const response = await signUp(makeAuth(), nextEmail());

      const raw = pendingSetCookie(response)?.toLowerCase() ?? "";
      expect(raw).toContain("httponly");
      expect(raw).toContain("secure");
      expect(raw).toContain("max-age=3600");
    });

    it("login kata sandi benar yang 403 EMAIL_NOT_VERIFIED memasang cookie email_pending", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUp(auth, email);

      const response = await signIn(auth, email);

      expect(response.status).toBe(403);
      expect(pendingSetCookie(response)).toBeDefined();
    });

    it("login kata sandi salah → 401 tanpa cookie email_pending", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUp(auth, email);

      const response = await signIn(auth, email, "salah-sama-sekali-123");

      expect(response.status).toBe(HTTP_UNAUTHORIZED);
      expect(pendingSetCookie(response)).toBeUndefined();
    });
  });

  describe("pendaftar sah (membawa cookie)", () => {
    it("cookie dari sign-up → kata sandi tetap, passwordSetupRequired false, cookie dihapus", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      const cookie = pendingCookieOf(await signUp(auth, email));

      const response = await verify(auth, email, latestCode(email), cookie);

      expect(response.status).toBe(HTTP_OK);
      await expect(response.json()).resolves.toMatchObject({
        passwordSetupRequired: false,
        status: true,
      });
      expect(pendingSetCookie(response)?.toLowerCase()).toContain("max-age=0");
      await expect(signInStatus(auth, email)).resolves.toBe(HTTP_OK);
      expect(outbox.latestFor(email)?.template).toBe("verification-otp");
    });

    it("cookie dari login 403 (perangkat lain) juga membuktikan kata sandi", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUp(auth, email);
      const cookie = pendingCookieOf(await signIn(auth, email));

      const response = await verify(auth, email, latestCode(email), cookie);

      await expect(response.json()).resolves.toMatchObject({
        passwordSetupRequired: false,
      });
      await expect(signInStatus(auth, email)).resolves.toBe(HTTP_OK);
    });
  });

  describe("tanpa bukti kata sandi", () => {
    it("akun penyerang diverifikasi korban: kata sandi, sesi, dan telepon penyerang dicabut", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      const userId = await preHijack(auth, email);
      await post(auth, "/email-otp/send-verification-otp", {
        email,
        type: "email-verification",
      });

      const response = await verify(auth, email, latestCode(email));

      expect(response.status).toBe(HTTP_OK);
      await expect(response.json()).resolves.toMatchObject({
        passwordSetupRequired: true,
        status: true,
      });
      await expect(accessOf(userId)).resolves.toStrictEqual({
        accounts: 0,
        phone: null,
        phoneVerified: false,
        sessions: 0,
      });
      await expect(signInStatus(auth, email, ATTACKER_PASSWORD)).resolves.toBe(
        HTTP_UNAUTHORIZED
      );
    });

    it("korban menerima tautan buat kata sandi ke APP_URL, lalu bisa login dengan kata sandi baru", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await preHijack(auth, email);
      await verify(auth, email, latestCode(email));

      const link = setupLinkFor(email);
      const redirect = await auth.handler(
        new Request(link, { headers: { "cf-connecting-ip": nextIp() } })
      );
      const location = new URL(redirect.headers.get("location") ?? "");
      const reset = await post(auth, "/reset-password", {
        newPassword: NEW_PASSWORD,
        token: location.searchParams.get("token"),
      });

      expect(redirect.status).toBe(302);
      expect(`${location.origin}${location.pathname}`).toBe(
        `${APP_ORIGIN}/reset-password`
      );
      expect(reset.status).toBe(HTTP_OK);
      await expect(signInStatus(auth, email, NEW_PASSWORD)).resolves.toBe(
        HTTP_OK
      );
    });

    it.each([
      ["cookie akun lain", "other"],
      ["cookie rusak", "tampered"],
    ] as const)("%s tidak membuktikan kata sandi", async (_label, kind) => {
      const auth = makeAuth();
      const email = nextEmail();
      const userId = await preHijack(auth, email);
      const other = pendingCookieOf(await signUp(auth, nextEmail()));
      const ownTampered = `${PENDING_COOKIE}=${userId}.tanda-tangan-palsu`;
      const cookie = kind === "other" ? other : ownTampered;

      const response = await verify(auth, email, latestCode(email), cookie);

      await expect(response.json()).resolves.toMatchObject({
        passwordSetupRequired: true,
      });
      await expect(accessOf(userId)).resolves.toMatchObject({ accounts: 0 });
    });

    it("verify gagal (kode salah) tidak mengubah akses apa pun", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      const userId = await preHijack(auth, email);
      const code = latestCode(email);

      const response = await verify(
        auth,
        email,
        code === "000000" ? "111111" : "000000"
      );

      expect(response.status).toBe(400);
      await expect(accessOf(userId)).resolves.toStrictEqual({
        accounts: 1,
        phone: ATTACKER_PHONE,
        phoneVerified: true,
        sessions: 1,
      });
    });
  });

  it("akun yang sudah terverifikasi: verify tanpa cookie tidak mengubah apa pun", async () => {
    const auth = makeAuth();
    const email = nextEmail();
    await signUp(auth, email);
    const code = latestCode(email);
    await markEmailVerified(auth, email);
    const before = outbox.list().length;

    const response = await verify(auth, email, code);

    expect(response.status).toBe(HTTP_OK);
    await expect(response.json()).resolves.toMatchObject({
      passwordSetupRequired: false,
    });
    await expect(signInStatus(auth, email)).resolves.toBe(HTTP_OK);
    expect(outbox.list()).toHaveLength(before);
  });
});
