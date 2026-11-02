import { createTestDb } from "@trush/db/testing";
import { createEmailOutbox, createEmailSender } from "@trush/email";
import type { EmailOutbox } from "@trush/email";
import { createOutbox, createPhoneSender } from "@trush/phone";
import type { Outbox } from "@trush/phone";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_BASE_PATH, createAuth } from "./auth";
import type { AuthEnv } from "./auth";
import { DISABLED_EMAIL_OTP_PATHS } from "./email";
import { createOtpRateLimiter } from "./otp-rate-limit";
import { TEST_EMAIL_ENV, markEmailVerified } from "./testing";

// Semua nilai palsu; email dan telepon driver memory, fetch keluar di-mock.
const ORIGIN = "http://localhost:5174";
const RESET_REDIRECT = `${ORIGIN}/reset-password`;
const SESSION_COOKIE = "__Secure-better-auth.session_token";
const PASSWORD = "kata-sandi-uji-yang-cukup-panjang-42";
const NEW_PASSWORD = "kata-sandi-baru-yang-juga-panjang-77";
const PHONE = "+6281234567890";
const SIX_DIGITS = /^\d{6}$/u;
const EMAIL_REQUEST_MAX = 5;
const HTTP_OK = 200;
const HTTP_TOO_MANY_REQUESTS = 429;

const BASE_ENV: AuthEnv = {
  ...TEST_EMAIL_ENV,
  APP_ENV: "development",
  AUTH_COOKIE_DOMAIN: undefined,
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:8787",
  CORS_ORIGINS: [ORIGIN],
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
  return `192.0.2.${ipCounter % 250}`;
};

let emailCounter = 0;
const nextEmail = (): string => {
  emailCounter += 1;
  return `email-${emailCounter}@example.test`;
};

type TestAuth = ReturnType<typeof createAuth>;

interface PostOptions {
  body?: unknown;
  cookie?: string;
}

const post = (
  auth: TestAuth,
  path: string,
  { body = {}, cookie }: PostOptions = {}
): Promise<Response> => {
  const headers = new Headers({
    "cf-connecting-ip": nextIp(),
    "content-type": "application/json",
    origin: ORIGIN,
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

const sessionCookieOf = (response: Response): string | undefined =>
  response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))
    ?.split(";")[0];

/** Cookie sesi yang membawa token (bukan penghapusan `Max-Age=0`). */
const setsLiveSession = (response: Response): boolean =>
  response.headers
    .getSetCookie()
    .some(
      (cookie) =>
        cookie.startsWith(`${SESSION_COOKIE}=`) &&
        !cookie.startsWith(`${SESSION_COOKIE}=;`) &&
        !/max-age=0/iu.test(cookie)
    );

const requireCookie = (response: Response): string => {
  const cookie = sessionCookieOf(response);
  if (cookie === undefined) {
    throw new Error(`cookie sesi tidak di-set (HTTP ${response.status})`);
  }
  return cookie;
};

const errorCode = async (response: Response): Promise<unknown> => {
  const body: unknown = await response.json();
  return typeof body === "object" && body !== null && "code" in body
    ? body.code
    : undefined;
};

const signUpRaw = (auth: TestAuth, email: string) =>
  post(auth, "/sign-up/email", {
    body: { email, name: "Pengguna Email", password: PASSWORD },
  });

const signIn = (auth: TestAuth, email: string, password = PASSWORD) =>
  post(auth, "/sign-in/email", { body: { email, password } });

const verifyEmail = (auth: TestAuth, email: string, otp: string) =>
  post(auth, "/email-otp/verify-email", { body: { email, otp } });

const sendVerification = (auth: TestAuth, email: string, type: string) =>
  post(auth, "/email-otp/send-verification-otp", { body: { email, type } });

const requestReset = (auth: TestAuth, email: string) =>
  post(auth, "/request-password-reset", {
    body: { email, redirectTo: RESET_REDIRECT },
  });

/** Pengguna terverifikasi + login; mengembalikan cookie sesi. */
const verifiedUser = async (auth: TestAuth, email: string) => {
  await signUpRaw(auth, email);
  await markEmailVerified(auth, email);
  return requireCookie(await signIn(auth, email));
};
/** Jalankan permintaan berurutan (hitungan percobaan/kuota deterministik). */
const sequential = async (
  tasks: readonly (() => Promise<Response>)[]
): Promise<number[]> => {
  const [first, ...rest] = tasks;
  if (first === undefined) {
    return [];
  }
  const { status } = await first();
  return [status, ...(await sequential(rest))];
};

const repeat = (
  count: number,
  task: (index: number) => Promise<Response>
): (() => Promise<Response>)[] =>
  Array.from({ length: count }, (_, index) => () => task(index));

describe("email: verifikasi, reset password, kuota (B15)", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;
  let emailOutbox: EmailOutbox;
  let phoneOutbox: Outbox;

  const makeAuth = ({
    env = {},
    limited = false,
  }: { env?: Partial<AuthEnv>; limited?: boolean } = {}) => {
    const fullEnv = { ...BASE_ENV, ...env };
    return createAuth({
      db: handle.db,
      emailSender: createEmailSender({ env: fullEnv, outbox: emailOutbox }),
      env: fullEnv,
      // Development mematikan kuota; dipasang eksplisit untuk test kuota.
      otpRateLimiter: limited ? createOtpRateLimiter(handle.db) : undefined,
      phoneSender: createPhoneSender({ env: fullEnv, outbox: phoneOutbox }),
    });
  };

  const latestCode = (email: string): string => {
    const code = emailOutbox.latestFor(email)?.code;
    if (!code) {
      throw new Error("kode verifikasi tidak ada di outbox");
    }
    return code;
  };

  const countRows = async (table: "session" | "user"): Promise<number> => {
    const result = await handle.db.execute<{ total: number }>(
      sql`select count(*)::int as total from ${sql.identifier(table)}`
    );
    return result.rows[0]?.total ?? 0;
  };

  const emailVerifiedOf = async (email: string): Promise<boolean> => {
    const result = await handle.db.execute<{ verified: boolean }>(
      sql`select email_verified as verified from "user" where email = ${email}`
    );
    return result.rows[0]?.verified ?? false;
  };

  /** Tautan reset dari outbox → token (lewat redirect `?token=`). */
  const resetTokenFor = async (auth: TestAuth, email: string) => {
    const entry = emailOutbox.latestFor(email);
    const link = entry?.body.match(/https?:\/\/\S+reset-password\/\S+/u)?.[0];
    if (!link || entry?.template !== "password-reset") {
      throw new Error("tautan reset tidak ada di outbox");
    }
    const redirect = await auth.handler(
      new Request(link, { headers: { "cf-connecting-ip": nextIp() } })
    );
    const location = redirect.headers.get("location") ?? "";
    return { link, location, redirect };
  };

  beforeEach(async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(fakeFetch);
    handle = await createTestDb();
    emailOutbox = createEmailOutbox();
    phoneOutbox = createOutbox();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await handle.close();
  });

  describe("sign-up dan login sebelum verifikasi", () => {
    it("sign-up → 200 tanpa sesi, kode 6 digit terkirim ke email", async () => {
      const auth = makeAuth();
      const email = nextEmail();

      const response = await signUpRaw(auth, email);

      expect(response.status).toBe(HTTP_OK);
      expect(setsLiveSession(response)).toBeFalsy();
      expect(emailOutbox.latestFor(email)).toMatchObject({
        code: expect.stringMatching(SIX_DIGITS),
        template: "verification-otp",
      });
      await expect(countRows("session")).resolves.toBe(0);
    });

    it("password salah → 401 (bukan 403): status verifikasi tidak bocor", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUpRaw(auth, email);

      const response = await signIn(auth, email, "salah-sama-sekali-123");

      expect(response.status).toBe(401);
      await expect(errorCode(response)).resolves.not.toBe("EMAIL_NOT_VERIFIED");
    });

    it("password benar → 403 EMAIL_NOT_VERIFIED, tanpa sesi, kode baru dikirim", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUpRaw(auth, email);
      const before = emailOutbox.list().length;

      const response = await signIn(auth, email);

      expect(response.status).toBe(403);
      await expect(errorCode(response)).resolves.toBe("EMAIL_NOT_VERIFIED");
      expect(setsLiveSession(response)).toBeFalsy();
      await expect(countRows("session")).resolves.toBe(0);
      expect(emailOutbox.list()).toHaveLength(before + 1);
    });

    it("/sign-in/phone-number dengan email belum terverifikasi → 403 EMAIL_NOT_VERIFIED, sesi baru dihapus", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      const cookie = await verifiedUser(auth, email);
      await post(auth, "/phone-number/send-otp", {
        body: { currentPassword: PASSWORD, phoneNumber: PHONE },
        cookie,
      });
      const verified = await post(auth, "/phone-number/verify", {
        body: {
          code: phoneOutbox.latestFor(PHONE)?.code,
          phoneNumber: PHONE,
          updatePhoneNumber: true,
        },
        cookie,
      });
      expect(verified.status).toBe(HTTP_OK);
      await handle.db.execute(
        sql`update "user" set email_verified = false where email = ${email}`
      );
      const sessionsBefore = await countRows("session");

      const response = await post(auth, "/sign-in/phone-number", {
        body: { password: PASSWORD, phoneNumber: PHONE },
      });

      expect(response.status).toBe(403);
      await expect(errorCode(response)).resolves.toBe("EMAIL_NOT_VERIFIED");
      expect(setsLiveSession(response)).toBeFalsy();
      await expect(countRows("session")).resolves.toBe(sessionsBefore);
    });

    it("/sign-in/phone-number password salah tetap 401", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      const cookie = await verifiedUser(auth, email);
      await post(auth, "/phone-number/send-otp", {
        body: { currentPassword: PASSWORD, phoneNumber: PHONE },
        cookie,
      });
      await post(auth, "/phone-number/verify", {
        body: {
          code: phoneOutbox.latestFor(PHONE)?.code,
          phoneNumber: PHONE,
          updatePhoneNumber: true,
        },
        cookie,
      });
      await handle.db.execute(
        sql`update "user" set email_verified = false where email = ${email}`
      );

      const response = await post(auth, "/sign-in/phone-number", {
        body: { password: "salah-sama-sekali-123", phoneNumber: PHONE },
      });

      expect(response.status).toBe(401);
    });
  });

  describe("OTP verifikasi email", () => {
    it("kode benar → terverifikasi tanpa sesi otomatis, lalu login berhasil", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUpRaw(auth, email);

      const response = await verifyEmail(auth, email, latestCode(email));

      expect(response.status).toBe(HTTP_OK);
      await expect(response.json()).resolves.toMatchObject({
        status: true,
        token: null,
      });
      expect(setsLiveSession(response)).toBeFalsy();
      await expect(emailVerifiedOf(email)).resolves.toBeTruthy();
      const signedIn = await signIn(auth, email);
      expect(signedIn.status).toBe(HTTP_OK);
    });

    it("alamat beda huruf besar/kecil tetap cocok", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUpRaw(auth, email);

      const response = await verifyEmail(
        auth,
        email.toUpperCase(),
        latestCode(email)
      );

      expect(response.status).toBe(HTTP_OK);
    });

    it("kode salah → 400 INVALID_OTP, email tetap belum terverifikasi", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUpRaw(auth, email);
      const wrong = latestCode(email) === "000000" ? "111111" : "000000";

      const response = await verifyEmail(auth, email, wrong);

      expect(response.status).toBe(400);
      await expect(errorCode(response)).resolves.toBe("INVALID_OTP");
      await expect(emailVerifiedOf(email)).resolves.toBeFalsy();
    });

    it("3 kode salah → 403 TOO_MANY_ATTEMPTS, kode benar sesudahnya ditolak", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUpRaw(auth, email);
      const code = latestCode(email);
      const wrong = code === "000000" ? "111111" : "000000";
      await sequential(repeat(3, () => verifyEmail(auth, email, wrong)));

      const locked = await verifyEmail(auth, email, code);

      expect(locked.status).toBe(403);
      await expect(errorCode(locked)).resolves.toBe("TOO_MANY_ATTEMPTS");
      const again = await verifyEmail(auth, email, code);
      expect(again.status).toBe(400);
      await expect(emailVerifiedOf(email)).resolves.toBeFalsy();
    });

    it("kode kedaluwarsa → 400 OTP_EXPIRED", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUpRaw(auth, email);
      const code = latestCode(email);
      await handle.db.execute(
        sql`update "verification" set expires_at = now() - interval '1 minute'`
      );

      const response = await verifyEmail(auth, email, code);

      expect(response.status).toBe(400);
      await expect(errorCode(response)).resolves.toBe("OTP_EXPIRED");
    });

    it("kode sekali pakai: verifikasi ulang dengan kode yang sama ditolak", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUpRaw(auth, email);
      const code = latestCode(email);
      await verifyEmail(auth, email, code);

      const again = await verifyEmail(auth, email, code);

      expect(again.status).toBe(400);
    });

    it("kode tersimpan sebagai hash, bukan kode mentah", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUpRaw(auth, email);

      const result = await handle.db.execute<{ value: string }>(
        sql`select value from "verification"`
      );

      expect(JSON.stringify(result.rows)).not.toContain(latestCode(email));
    });
  });

  describe("kirim ulang kode (/email-otp/send-verification-otp)", () => {
    it.each(["sign-in", "forget-password", "change-email", "lainnya"])(
      "type %s → 400 INVALID_OTP_TYPE tanpa email",
      async (type) => {
        const auth = makeAuth();
        const email = nextEmail();
        await signUpRaw(auth, email);
        const before = emailOutbox.list().length;

        const response = await sendVerification(auth, email, type);

        expect(response.status).toBe(400);
        await expect(errorCode(response)).resolves.toBe("INVALID_OTP_TYPE");
        expect(emailOutbox.list()).toHaveLength(before);
      }
    );

    it("terdaftar belum terverifikasi → kode baru; respons identik dengan alamat tak terdaftar", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUpRaw(auth, email);
      const first = latestCode(email);

      const registered = await sendVerification(
        auth,
        email,
        "email-verification"
      );
      const unknown = await sendVerification(
        auth,
        "tidak-terdaftar@example.test",
        "email-verification"
      );

      expect(registered.status).toBe(unknown.status);
      await expect(registered.json()).resolves.toStrictEqual(
        await unknown.json()
      );
      expect(
        emailOutbox.list().filter((entry) => entry.to === email)
      ).toHaveLength(2);
      expect(latestCode(email)).not.toBe(first);
      expect(
        emailOutbox.latestFor("tidak-terdaftar@example.test")
      ).toBeUndefined();
    });

    it("alamat sudah terverifikasi → 200 tanpa email", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await verifiedUser(auth, email);
      const before = emailOutbox.list().length;

      const response = await sendVerification(
        auth,
        email,
        "email-verification"
      );

      expect(response.status).toBe(HTTP_OK);
      expect(emailOutbox.list()).toHaveLength(before);
    });
  });

  describe("endpoint emailOTP yang dimatikan", () => {
    it.each(DISABLED_EMAIL_OTP_PATHS)("%s → 404", async (path) => {
      const auth = makeAuth();
      const email = nextEmail();
      await signUpRaw(auth, email);

      const response = await post(auth, path, {
        body: {
          email,
          newEmail: nextEmail(),
          otp: "123456",
          password: NEW_PASSWORD,
        },
      });

      expect(response.status).toBe(404);
    });
  });

  describe("kuota per alamat (5/jam) tanpa oracle", () => {
    it.each([
      ["kirim ulang kode", "verify"],
      ["lupa password", "reset"],
    ] as const)(
      "%s: permintaan ke-6 → 429 OTP_RATE_LIMITED, sama untuk alamat terdaftar dan tidak",
      async (_label, kind) => {
        const auth = makeAuth({ limited: true });
        const registered = nextEmail();
        await signUpRaw(auth, registered);
        const send = (email: string) =>
          kind === "verify"
            ? sendVerification(auth, email, "email-verification")
            : requestReset(auth, email);

        const known = await sequential(
          repeat(EMAIL_REQUEST_MAX + 1, () => send(registered))
        );
        const unknown = await sequential(
          repeat(EMAIL_REQUEST_MAX + 1, () => send("tidak-ada@example.test"))
        );

        const expected = [
          ...Array.from({ length: EMAIL_REQUEST_MAX }, () => HTTP_OK),
          HTTP_TOO_MANY_REQUESTS,
        ];
        expect(known).toStrictEqual(expected);
        expect(unknown).toStrictEqual(expected);
        const limited = await send(registered);
        await expect(errorCode(limited)).resolves.toBe("OTP_RATE_LIMITED");
      }
    );

    it("kuota kirim ulang dan lupa password terpisah; alamat beda huruf berbagi kuota", async () => {
      const auth = makeAuth({ limited: true });
      const email = nextEmail();
      await signUpRaw(auth, email);
      await sequential(
        repeat(EMAIL_REQUEST_MAX, (index) =>
          sendVerification(
            auth,
            index % 2 === 0 ? email : email.toUpperCase(),
            "email-verification"
          )
        )
      );

      const blocked = await sendVerification(auth, email, "email-verification");
      const reset = await requestReset(auth, email);

      expect(blocked.status).toBe(HTTP_TOO_MANY_REQUESTS);
      expect(reset.status).toBe(HTTP_OK);
    });
  });

  describe("reset password lewat tautan", () => {
    it("respons identik untuk alamat terdaftar dan tidak; email hanya ke yang terdaftar", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await verifiedUser(auth, email);

      const registered = await requestReset(auth, email);
      const unknown = await requestReset(auth, "tidak-ada@example.test");

      expect(registered.status).toBe(HTTP_OK);
      expect(unknown.status).toBe(HTTP_OK);
      await expect(registered.json()).resolves.toStrictEqual(
        await unknown.json()
      );
      expect(emailOutbox.latestFor(email)?.template).toBe("password-reset");
      expect(emailOutbox.latestFor("tidak-ada@example.test")).toBeUndefined();
    });

    it("tautan email → redirect ke redirectTo dengan ?token=", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await verifiedUser(auth, email);
      await requestReset(auth, email);

      const { location, redirect } = await resetTokenFor(auth, email);

      expect(redirect.status).toBe(302);
      const target = new URL(location);
      expect(`${target.origin}${target.pathname}`).toBe(RESET_REDIRECT);
      expect(target.searchParams.get("token")).toBeTruthy();
    });

    it("reset sukses: semua sesi dicabut, password lama ditolak, password baru diterima", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      const cookie = await verifiedUser(auth, email);
      await requestReset(auth, email);
      const { location } = await resetTokenFor(auth, email);
      const token = new URL(location).searchParams.get("token");

      const response = await post(auth, "/reset-password", {
        body: { newPassword: NEW_PASSWORD, token },
      });

      expect(response.status).toBe(HTTP_OK);
      await expect(
        auth.api.getSession({ headers: new Headers({ cookie }) })
      ).resolves.toBeNull();
      const oldPassword = await signIn(auth, email);
      const newPassword = await signIn(auth, email, NEW_PASSWORD);
      expect(oldPassword.status).toBe(401);
      expect(newPassword.status).toBe(HTTP_OK);
    });

    it("token sekali pakai: reset kedua → 400 INVALID_TOKEN", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await verifiedUser(auth, email);
      await requestReset(auth, email);
      const { location } = await resetTokenFor(auth, email);
      const token = new URL(location).searchParams.get("token");
      await post(auth, "/reset-password", {
        body: { newPassword: NEW_PASSWORD, token },
      });

      const again = await post(auth, "/reset-password", {
        body: { newPassword: "kata-sandi-ketiga-yang-panjang-99", token },
      });

      expect(again.status).toBe(400);
      await expect(errorCode(again)).resolves.toBe("INVALID_TOKEN");
    });

    it("token palsu → 400 INVALID_TOKEN", async () => {
      const response = await post(makeAuth(), "/reset-password", {
        body: { newPassword: NEW_PASSWORD, token: "token-palsu-sama-sekali" },
      });

      expect(response.status).toBe(400);
      await expect(errorCode(response)).resolves.toBe("INVALID_TOKEN");
    });

    it("token kedaluwarsa: tautan redirect ?error=INVALID_TOKEN, reset → INVALID_TOKEN", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await verifiedUser(auth, email);
      await requestReset(auth, email);
      const { location: token } = await resetTokenFor(auth, email);
      await handle.db.execute(
        sql`update "verification" set expires_at = now() - interval '1 minute'`
      );

      const { location } = await resetTokenFor(auth, email);
      const response = await post(auth, "/reset-password", {
        body: {
          newPassword: NEW_PASSWORD,
          token: new URL(token).searchParams.get("token"),
        },
      });

      expect(new URL(location).searchParams.get("error")).toBe("INVALID_TOKEN");
      await expect(errorCode(response)).resolves.toBe("INVALID_TOKEN");
    });

    it("redirectTo di luar CORS_ORIGINS ditolak tanpa email", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await verifiedUser(auth, email);
      const before = emailOutbox.list().length;

      const response = await post(auth, "/request-password-reset", {
        body: { email, redirectTo: "https://evil.example/reset-password" },
      });

      expect(response.status).toBe(403);
      expect(emailOutbox.list()).toHaveLength(before);
    });

    it("tautan resmi dengan callbackURL diganti origin asing tidak mengalihkan token", async () => {
      const auth = makeAuth();
      const email = nextEmail();
      await verifiedUser(auth, email);
      await requestReset(auth, email);
      const { link } = await resetTokenFor(auth, email);
      const tampered = new URL(link);
      tampered.searchParams.set(
        "callbackURL",
        "https://evil.example/reset-password"
      );

      const response = await auth.handler(
        new Request(tampered, { headers: { "cf-connecting-ip": nextIp() } })
      );

      expect(response.headers.get("location") ?? "").not.toContain(
        "evil.example"
      );
      expect(response.status).toBe(403);
    });
  });
});
