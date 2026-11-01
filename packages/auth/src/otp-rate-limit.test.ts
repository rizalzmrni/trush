import { createTestDb } from "@trush/db/testing";
import { createOutbox, createPhoneSender } from "@trush/phone";
import type { Outbox } from "@trush/phone";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_BASE_PATH, createAuth } from "./auth";
import type { AuthEnv } from "./auth";
import {
  createOtpRateLimiter,
  OTP_RATE_LIMITED,
  OTP_RATE_RULES,
} from "./otp-rate-limit";

// Semua nilai palsu; pengirim telepon driver memory, fetch keluar di-mock.
const ORIGIN = "http://localhost:5173";
const SESSION_COOKIE = "__Secure-better-auth.session_token";
const PASSWORD = "kata-sandi-uji-yang-cukup-panjang-42";
const TARGET = "+6281234567890";
const TARGET_LOCAL = "0812-3456-7890";
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_TOO_MANY_REQUESTS = 429;
const HOUR_SECONDS = 3600;
const PHONE_MAX = OTP_RATE_RULES.phone.max;
const USER_MAX = OTP_RATE_RULES.user.max;
const SEND_OTP = "/phone-number/send-otp";
const RESET = "/phone-number/request-password-reset";

const BASE_ENV: AuthEnv = {
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

// IP berbeda per request: batas per IP better-auth (3/menit, aktif di
// staging) tidak boleh menjadi penyebab 429; yang diuji batas pengguna/nomor.
let ipCounter = 0;
const nextIp = (): string => {
  ipCounter += 1;
  return `198.51.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
};

let emailCounter = 0;
const nextEmail = (): string => {
  emailCounter += 1;
  return `kuota-${emailCounter}@example.test`;
};

/** Nomor seluler ID unik dan valid: +62812 + 8 digit. */
const phoneAt = (index: number): string =>
  `+62812${String(10_000_000 + index).slice(-8)}`;

type TestAuth = ReturnType<typeof createAuth>;

const post = (
  auth: TestAuth,
  path: string,
  body: unknown,
  cookie?: string,
  { captcha = true }: { captcha?: boolean } = {}
): Promise<Response> => {
  const headers = new Headers({
    "cf-connecting-ip": nextIp(),
    "content-type": "application/json",
    origin: ORIGIN,
  });
  if (captcha) {
    headers.set("x-captcha-response", "XXXX.DUMMY.TOKEN.XXXX");
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

/** Daftar lewat email; mengembalikan cookie sesi. */
const signUp = async (auth: TestAuth): Promise<string> => {
  const response = await post(auth, "/sign-up/email", {
    email: nextEmail(),
    name: "Pengguna Kuota",
    password: PASSWORD,
  });
  const raw = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (!raw) {
    throw new Error(`cookie sesi tidak di-set (HTTP ${response.status})`);
  }
  return raw.split(";")[0] ?? "";
};

/** Jalankan permintaan berurutan (hitungan kuota harus deterministik). */
const sequential = async <T>(
  tasks: readonly (() => Promise<T>)[]
): Promise<T[]> => {
  const [first, ...rest] = tasks;
  if (first === undefined) {
    return [];
  }
  return [await first(), ...(await sequential(rest))];
};

const statusesOf = async (
  requests: readonly (() => Promise<Response>)[]
): Promise<number[]> => {
  const responses = await sequential(requests);
  return responses.map((response) => response.status);
};

const repeat = <T>(count: number, make: (index: number) => T): T[] =>
  Array.from({ length: count }, (_, index) => make(index));

const sendOtp = (auth: TestAuth, phoneNumber: string, cookie?: string) => () =>
  post(auth, SEND_OTP, { phoneNumber }, cookie);

const requestReset = (auth: TestAuth, phoneNumber: string) => () =>
  post(auth, RESET, { phoneNumber });

describe("kuota OTP per pengguna dan per nomor (B7c)", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;
  let outbox: Outbox;

  /**
   * `explicit`: limiter tabel dipasang langsung di development (batas IP
   * better-auth mati). `default`: pilihan bawaan `createAuth` menurut APP_ENV.
   */
  const makeAuth = (
    env: Partial<AuthEnv> = {},
    limiter: "default" | "explicit" = "explicit"
  ) => {
    const fullEnv = { ...BASE_ENV, ...env };
    return createAuth({
      db: handle.db,
      env: fullEnv,
      phoneSender: createPhoneSender({ env: fullEnv, outbox }),
      ...(limiter === "explicit"
        ? { otpRateLimiter: createOtpRateLimiter(handle.db) }
        : {}),
    });
  };

  /** Daftar + verifikasi nomor (akun terdaftar untuk reset password). */
  const registerPhone = async (auth: TestAuth, phone: string) => {
    const cookie = await signUp(auth);
    await post(auth, SEND_OTP, { phoneNumber: phone }, cookie);
    const response = await post(
      auth,
      "/phone-number/verify",
      {
        code: outbox.latestFor(phone)?.code,
        phoneNumber: phone,
        updatePhoneNumber: true,
      },
      cookie
    );
    if (response.status !== HTTP_OK) {
      throw new Error(`verifikasi nomor gagal: HTTP ${response.status}`);
    }
  };

  /** Mundurkan awal jendela semua kunci (jendela kedaluwarsa). */
  const expireWindows = async () => {
    await handle.db.execute(
      sql`update "otp_rate_limit" set "window_start" = now() - make_interval(secs => ${HOUR_SECONDS + 1})`
    );
  };

  beforeEach(async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(fakeFetch);
    handle = await createTestDb();
    outbox = createOutbox();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await handle.close();
  });

  it("per nomor: reset password ke-6 → 429 OTP_RATE_LIMITED + Retry-After", async () => {
    const auth = makeAuth();

    const statuses = await statusesOf(
      repeat(PHONE_MAX, () => requestReset(auth, TARGET))
    );
    const limited = await requestReset(auth, TARGET)();

    expect(statuses).toStrictEqual(repeat(PHONE_MAX, () => HTTP_OK));
    expect(limited.status).toBe(HTTP_TOO_MANY_REQUESTS);
    await expect(limited.json()).resolves.toMatchObject(OTP_RATE_LIMITED);
    const retryAfter = Number(limited.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(HOUR_SECONDS);
  });

  it("reset password: 429 nomor terdaftar identik dengan nomor tak terdaftar", async () => {
    const auth = makeAuth();
    const registered = phoneAt(1);
    const unregistered = phoneAt(2);
    await registerPhone(auth, registered);
    // send-otp saat verifikasi ikut menghitung kuota nomor terdaftar; samakan
    // titik awal dengan memulai jendela baru.
    await expireWindows();
    await statusesOf([
      ...repeat(PHONE_MAX, () => requestReset(auth, registered)),
      ...repeat(PHONE_MAX, () => requestReset(auth, unregistered)),
    ]);

    const a = await requestReset(auth, registered)();
    const b = await requestReset(auth, unregistered)();

    expect(a.status).toBe(HTTP_TOO_MANY_REQUESTS);
    expect(b.status).toBe(a.status);
    const unregisteredBody = await b.text();
    await expect(a.text()).resolves.toBe(unregisteredBody);
  });

  it("per nomor: pengguna berbeda (dan IP berbeda) ke nomor sama tetap dibatasi", async () => {
    const auth = makeAuth();
    const cookies = await sequential(
      repeat(PHONE_MAX + 1, () => () => signUp(auth))
    );

    const statuses = await statusesOf(
      cookies.map((cookie) => sendOtp(auth, TARGET, cookie))
    );

    expect(statuses).toStrictEqual([
      ...repeat(PHONE_MAX, () => HTTP_OK),
      HTTP_TOO_MANY_REQUESTS,
    ]);
    // Permintaan yang ditolak tidak membuat/mengirim OTP.
    expect(outbox.list()).toHaveLength(PHONE_MAX);
  });

  it("per nomor: send-otp dan reset password berbagi kuota", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    const sends = PHONE_MAX - 2;

    const statuses = await statusesOf([
      ...repeat(sends, () => sendOtp(auth, TARGET, cookie)),
      ...repeat(PHONE_MAX - sends, () => requestReset(auth, TARGET)),
      sendOtp(auth, TARGET, cookie),
    ]);

    expect(statuses.at(-1)).toBe(HTTP_TOO_MANY_REQUESTS);
    expect(statuses.slice(0, -1)).toStrictEqual(
      repeat(PHONE_MAX, () => HTTP_OK)
    );
  });

  it("per nomor: format lokal dan E.164 dihitung sebagai nomor yang sama", async () => {
    const auth = makeAuth();

    const statuses = await statusesOf(
      repeat(PHONE_MAX + 1, (index) =>
        requestReset(auth, index % 2 === 0 ? TARGET_LOCAL : TARGET)
      )
    );

    expect(statuses.at(-1)).toBe(HTTP_TOO_MANY_REQUESTS);
  });

  it("per pengguna: nomor berbeda dari IP berbeda, permintaan ke-11 → 429", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);

    const statuses = await statusesOf(
      repeat(USER_MAX + 1, (index) => sendOtp(auth, phoneAt(index), cookie))
    );
    const limited = await sendOtp(auth, phoneAt(USER_MAX + 1), cookie)();

    expect(statuses.slice(0, USER_MAX)).toStrictEqual(
      repeat(USER_MAX, () => HTTP_OK)
    );
    expect(statuses.at(-1)).toBe(HTTP_TOO_MANY_REQUESTS);
    expect(limited.status).toBe(HTTP_TOO_MANY_REQUESTS);
    await expect(limited.json()).resolves.toMatchObject(OTP_RATE_LIMITED);
    expect(outbox.list()).toHaveLength(USER_MAX);
  });

  it("per pengguna: kuota satu pengguna tidak membatasi pengguna lain", async () => {
    const auth = makeAuth();
    const spender = await signUp(auth);
    const other = await signUp(auth);
    await statusesOf(
      repeat(USER_MAX + 1, (index) => sendOtp(auth, phoneAt(index), spender))
    );

    const response = await sendOtp(auth, phoneAt(100), other)();

    expect(response.status).toBe(HTTP_OK);
  });

  it("send-otp tanpa sesi tidak menghabiskan kuota nomor korban", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    await statusesOf(repeat(PHONE_MAX + 2, () => sendOtp(auth, TARGET)));

    const response = await sendOtp(auth, TARGET, cookie)();

    expect(response.status).toBe(HTTP_OK);
    expect(outbox.latestFor(TARGET)).toBeDefined();
  });

  it("permintaan tanpa captcha ditolak sebelum menghitung kuota", async () => {
    const auth = makeAuth();
    const rejected = await statusesOf(
      repeat(
        PHONE_MAX + 1,
        () => () =>
          post(auth, RESET, { phoneNumber: TARGET }, undefined, {
            captcha: false,
          })
      )
    );

    const response = await requestReset(auth, TARGET)();

    expect(rejected).toStrictEqual(
      repeat(PHONE_MAX + 1, () => HTTP_BAD_REQUEST)
    );
    expect(response.status).toBe(HTTP_OK);
  });

  it("jendela kedaluwarsa → kuota nomor pulih", async () => {
    const auth = makeAuth();
    await statusesOf(repeat(PHONE_MAX + 1, () => requestReset(auth, TARGET)));
    await expireWindows();

    const response = await requestReset(auth, TARGET)();

    expect(response.status).toBe(HTTP_OK);
  });

  it("default createAuth: aktif di staging (429 OTP_RATE_LIMITED)", async () => {
    const auth = makeAuth({ APP_ENV: "staging" }, "default");

    const statuses = await statusesOf(
      repeat(PHONE_MAX + 1, () => requestReset(auth, TARGET))
    );
    const limited = await requestReset(auth, TARGET)();

    expect(statuses.at(-1)).toBe(HTTP_TOO_MANY_REQUESTS);
    await expect(limited.json()).resolves.toMatchObject(OTP_RATE_LIMITED);
  });

  it("default createAuth: mati di development", async () => {
    const auth = makeAuth({}, "default");

    const statuses = await statusesOf(
      repeat(PHONE_MAX + 2, () => requestReset(auth, TARGET))
    );

    expect(statuses).toStrictEqual(repeat(PHONE_MAX + 2, () => HTTP_OK));
  });
});
