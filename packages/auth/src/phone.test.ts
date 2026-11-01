import { createTestDb } from "@trush/db/testing";
import {
  createOutbox,
  createPhoneSender,
  PhoneError,
  toE164,
} from "@trush/phone";
import type { Outbox, PhoneErrorCode, PhoneSender } from "@trush/phone";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_BASE_PATH, createAuth } from "./auth";
import type { AuthEnv } from "./auth";
import { OTP_CHANNEL_HEADER, otpChannelFrom } from "./phone";

// Semua nilai palsu; pengirim telepon driver memory, fetch keluar di-mock.
const ORIGIN = "http://localhost:5173";
const SESSION_COOKIE = "__Secure-better-auth.session_token";
const E164_ID = "+6281234567890";
const LOCAL_ID = "0812-3456-7890";
const MY_NUMBER = "+60123456789";
const PASSWORD = "kata-sandi-uji-yang-cukup-panjang-42";
const PHONE_SEND_LIMIT = 3;
const PHONE_VERIFY_LIMIT = 10;
const HTTP_TOO_MANY_REQUESTS = 429;
const SIX_DIGITS = /^\d{6}$/u;

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

/** PhoneError dari penyedia → status HTTP dan kode publik yang diharapkan. */
const PHONE_ERROR_CASES: readonly (readonly [
  PhoneErrorCode,
  number,
  string,
])[] = [
  ["INVALID_NUMBER", 400, "INVALID_NUMBER"],
  ["UNSUPPORTED_DESTINATION", 400, "UNSUPPORTED_DESTINATION"],
  ["NOT_ALLOWLISTED", 400, "NOT_ALLOWLISTED"],
  ["RECIPIENT_UNREACHABLE", 422, "RECIPIENT_UNREACHABLE"],
  ["RATE_LIMITED", 429, "RATE_LIMITED"],
  ["PROVIDER_CONFIG", 502, "OTP_DELIVERY_FAILED"],
  ["PROVIDER_ERROR", 502, "OTP_DELIVERY_FAILED"],
];

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
  return `198.51.100.${ipCounter}`;
};

let emailCounter = 0;
const nextEmail = (): string => {
  emailCounter += 1;
  return `pengguna-${emailCounter}@example.test`;
};

interface PostOptions {
  body?: unknown;
  captcha?: boolean;
  cookie?: string;
  headers?: Record<string, string>;
  ip?: string;
}

type TestAuth = ReturnType<typeof createAuth>;

const postTo = (
  auth: TestAuth,
  path: string,
  {
    body = {},
    captcha = true,
    cookie,
    headers = {},
    ip = nextIp(),
  }: PostOptions
): Promise<Response> => {
  const requestHeaders = new Headers({
    "cf-connecting-ip": ip,
    "content-type": "application/json",
    origin: ORIGIN,
    ...headers,
  });
  if (captcha) {
    requestHeaders.set("x-captcha-response", "XXXX.DUMMY.TOKEN.XXXX");
  }
  if (cookie) {
    requestHeaders.set("cookie", cookie);
  }
  return auth.handler(
    new Request(`${BASE_ENV.BETTER_AUTH_URL}${AUTH_BASE_PATH}${path}`, {
      body: JSON.stringify(body),
      headers: requestHeaders,
      method: "POST",
    })
  );
};

const sessionCookieOf = (response: Response): string => {
  const raw = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (!raw) {
    throw new Error("cookie sesi tidak di-set");
  }
  return raw.split(";")[0] ?? "";
};

const sendOtp = (
  auth: TestAuth,
  phoneNumber: string,
  options: Omit<PostOptions, "body"> = {}
) =>
  postTo(auth, "/phone-number/send-otp", {
    ...options,
    // Step-up (B11): setiap send-otp dengan sesi wajib password saat ini.
    body: options.cookie
      ? { currentPassword: PASSWORD, phoneNumber }
      : { phoneNumber },
  });

const OTHER_ID = "+6281299998888";
const HTTP_BAD_REQUEST = 400;
const HTTP_SERVER_ERROR = 500;

/** Response membawa cookie sesi baru (login terjadi). */
const setsSessionCookie = (response: Response): boolean =>
  response.headers
    .getSetCookie()
    .some((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));

/** Status 4xx: ditolak sebagai kesalahan permintaan. */
const isClientError = (status: number): boolean =>
  status >= HTTP_BAD_REQUEST && status < HTTP_SERVER_ERROR;

/** Daftar lewat email; mengembalikan cookie sesi. */
const signUp = async (auth: TestAuth): Promise<string> =>
  sessionCookieOf(
    await postTo(auth, "/sign-up/email", {
      body: { email: nextEmail(), name: "Pengguna Uji", password: PASSWORD },
    })
  );

/** Sign-up email yang menyelipkan `phoneNumber` di body (tanpa OTP). */
const signUpClaimingPhone = (auth: TestAuth, phoneNumber: string) =>
  postTo(auth, "/sign-up/email", {
    body: {
      email: nextEmail(),
      name: "Pengguna Uji",
      password: PASSWORD,
      phoneNumber,
    },
  });

/** Pengirim yang selalu gagal dengan `PhoneError` (meniru error Twilio). */
const failingSender =
  (code: PhoneErrorCode) =>
  (sender: PhoneSender): PhoneSender => ({
    ...sender,
    sendOtp: () =>
      Promise.reject(
        new PhoneError(code, `detail internal ${E164_ID}`, 21_211)
      ),
  });

interface BurstResult {
  last: Response | undefined;
  statuses: number[];
}

const burstStep = async (
  count: number,
  send: () => Promise<Response>,
  { last, statuses }: BurstResult
): Promise<BurstResult> => {
  if (statuses.length >= count) {
    return { last, statuses };
  }
  const response = await send();
  return burstStep(count, send, {
    last: response,
    statuses: [...statuses, response.status],
  });
};

/** `count` request berurutan (deterministik); status dan response terakhir. */
const burstFrom = (
  count: number,
  send: () => Promise<Response>
): Promise<BurstResult> =>
  burstStep(count, send, { last: undefined, statuses: [] });

/** Verify kode salah dari satu IP (tanpa captcha: verify tidak memintanya). */
const wrongVerify = (auth: TestAuth, ip: string, cookie?: string) => () =>
  postTo(auth, "/phone-number/verify", {
    body: { code: "000000", phoneNumber: E164_ID },
    captcha: false,
    cookie,
    ip,
  });

describe("plugin phoneNumber", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;
  let outbox: Outbox;

  const makeAuth = (
    env: Partial<AuthEnv> = {},
    wrapSender: (sender: PhoneSender) => PhoneSender = (sender) => sender
  ) => {
    const fullEnv = { ...BASE_ENV, ...env };
    return createAuth({
      db: handle.db,
      env: fullEnv,
      phoneSender: wrapSender(createPhoneSender({ env: fullEnv, outbox })),
    });
  };

  /** Pengguna login yang nomornya sudah terverifikasi; mengembalikan cookie. */
  const signUpWithPhone = async (
    auth: TestAuth,
    phone: string
  ): Promise<string> => {
    const cookie = await signUp(auth);
    await sendOtp(auth, phone, { cookie });
    const response = await postTo(auth, "/phone-number/verify", {
      body: {
        code: outbox.latestFor(toE164(phone, "ID") ?? phone)?.code,
        phoneNumber: phone,
        updatePhoneNumber: true,
      },
      cookie,
    });
    if (response.status !== 200) {
      throw new Error(`verifikasi nomor gagal: HTTP ${response.status}`);
    }
    return cookie;
  };

  /** Kode OTP tersimpan (`kode:percobaan`) langsung dari tabel verification. */
  const storedOtp = async (identifier: string): Promise<string | undefined> => {
    const result = await handle.db.execute<{ value: string }>(
      sql`select value from "verification" where identifier = ${identifier}`
    );
    return result.rows[0]?.value.split(":")[0];
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

  it("send-otp nomor lokal (login) → OTP di outbox dalam E.164, kanal WhatsApp", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);

    const response = await sendOtp(auth, LOCAL_ID, { cookie });

    expect(response.status).toBe(200);
    expect(outbox.list()).toStrictEqual([
      expect.objectContaining({
        channel: "whatsapp",
        code: expect.stringMatching(SIX_DIGITS),
        to: E164_ID,
      }),
    ]);
  });

  it("header x-otp-channel: sms memilih kanal SMS", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);

    await sendOtp(auth, E164_ID, {
      cookie,
      headers: { [OTP_CHANNEL_HEADER]: "sms" },
    });

    expect(outbox.latestFor(E164_ID)?.channel).toBe("sms");
  });

  it("nomor tak terdaftar tanpa sesi → 200 code sent tanpa kirim", async () => {
    const response = await sendOtp(makeAuth(), E164_ID);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      message: "code sent",
    });
    expect(outbox.list()).toStrictEqual([]);
  });

  it("nomor terdaftar tanpa sesi (login OTP mati) → 200 code sent tanpa kirim", async () => {
    const auth = makeAuth();
    await signUpWithPhone(auth, E164_ID);
    outbox.clear();

    const response = await sendOtp(auth, LOCAL_ID);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      message: "code sent",
    });
    expect(outbox.list()).toStrictEqual([]);
  });

  it.each([
    ["nomor Malaysia", MY_NUMBER],
    ["nomor tidak valid", "abc"],
    ["nomor terlalu pendek", "0812"],
  ])(
    "%s → 400 INVALID_PHONE_NUMBER tanpa entri outbox",
    async (_label, phone) => {
      const auth = makeAuth();
      const cookie = await signUp(auth);

      const response = await sendOtp(auth, phone, { cookie });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: "INVALID_PHONE_NUMBER",
      });
      expect(outbox.list()).toStrictEqual([]);
    }
  );

  it("allowlist: nomor di luar daftar → 400 tanpa entri outbox", async () => {
    const auth = makeAuth({ PHONE_ALLOWLIST: ["+6281299998888"] });
    const cookie = await signUp(auth);

    const response = await sendOtp(auth, E164_ID, { cookie });

    expect(response.status).toBe(400);
    expect(outbox.list()).toStrictEqual([]);
  });

  it("send-otp tanpa captcha → 400 tanpa entri outbox", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);

    const response = await sendOtp(auth, E164_ID, { captcha: false, cookie });

    expect(response.status).toBe(400);
    expect(outbox.list()).toStrictEqual([]);
  });

  it.each(PHONE_ERROR_CASES)(
    "PhoneError %s → HTTP %i kode %s, tanpa detail penyedia",
    async (phoneCode, status, code) => {
      const auth = makeAuth({}, failingSender(phoneCode));
      const cookie = await signUp(auth);

      const response = await sendOtp(auth, E164_ID, { cookie });
      const text = await response.text();

      expect(response.status).toBe(status);
      expect(JSON.parse(text)).toMatchObject({ code });
      expect(text).not.toContain(E164_ID);
      expect(text).not.toContain("21211");
    }
  );

  it("verify dengan kode salah → 400 INVALID_OTP", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    await sendOtp(auth, E164_ID, { cookie });
    const sent = outbox.latestFor(E164_ID)?.code ?? "";
    const wrong = sent === "000000" ? "111111" : "000000";

    const response = await postTo(auth, "/phone-number/verify", {
      body: { code: wrong, phoneNumber: E164_ID, updatePhoneNumber: true },
      cookie,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_OTP",
    });
  });

  it("verify kode benar + sesi + updatePhoneNumber → phone_number E.164 terverifikasi", async () => {
    await signUpWithPhone(makeAuth(), LOCAL_ID);

    const users = await handle.db.execute<{
      phone_number: string | null;
      phone_number_verified: boolean | null;
    }>(sql`select phone_number, phone_number_verified from "user"`);

    expect(users.rows).toStrictEqual([
      { phone_number: E164_ID, phone_number_verified: true },
    ]);
  });

  it("kode OTP hanya sekali pakai", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    await sendOtp(auth, E164_ID, { cookie });
    const body = {
      code: outbox.latestFor(E164_ID)?.code,
      phoneNumber: E164_ID,
      updatePhoneNumber: true,
    };
    await postTo(auth, "/phone-number/verify", { body, cookie });

    const replay = await postTo(auth, "/phone-number/verify", { body, cookie });

    // Setelah verify pertama akun sudah punya nomor terverifikasi; replay tanpa
    // grant step-up (B11) ditolak sebelum kode diperiksa.
    expect(replay.status).toBe(403);
    await expect(replay.json()).resolves.toMatchObject({
      code: "PASSWORD_REQUIRED",
    });
    expect(setsSessionCookie(replay)).toBeFalsy();
  });

  it("verify updatePhoneNumber tanpa sesi → 401", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    await sendOtp(auth, E164_ID, { cookie });

    const response = await postTo(auth, "/phone-number/verify", {
      body: {
        code: outbox.latestFor(E164_ID)?.code,
        phoneNumber: E164_ID,
        updatePhoneNumber: true,
      },
    });

    expect(response.status).toBe(401);
  });

  it("verify nomor tak terdaftar tanpa updatePhoneNumber, kode benar → 400 INVALID_OTP tanpa user baru", async () => {
    const auth = makeAuth();
    await sendOtp(auth, E164_ID);
    const code = await storedOtp(E164_ID);

    const response = await postTo(auth, "/phone-number/verify", {
      body: { code, phoneNumber: E164_ID },
    });
    const users = await handle.db.execute<{ total: number }>(
      sql`select count(*)::int as total from "user"`
    );

    expect(code).toMatch(SIX_DIGITS);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_OTP",
    });
    expect(users.rows).toStrictEqual([{ total: 0 }]);
  });

  it("sign-in nomor terverifikasi (format lokal) + password benar → sesi", async () => {
    const auth = makeAuth();
    await signUpWithPhone(auth, E164_ID);

    const response = await postTo(auth, "/sign-in/phone-number", {
      body: { password: PASSWORD, phoneNumber: LOCAL_ID },
    });

    expect(response.status).toBe(200);
    expect(sessionCookieOf(response)).toContain(SESSION_COOKIE);
  });

  it("sign-in nomor tak terdaftar dan password salah → 401 berkode sama", async () => {
    const auth = makeAuth();
    await signUpWithPhone(auth, E164_ID);

    const unknown = await postTo(auth, "/sign-in/phone-number", {
      body: { password: PASSWORD, phoneNumber: "081299998888" },
    });
    const wrongPassword = await postTo(auth, "/sign-in/phone-number", {
      body: { password: "salah-sama-sekali-123", phoneNumber: E164_ID },
    });
    const [unknownBody, wrongBody]: unknown[] = await Promise.all([
      unknown.json(),
      wrongPassword.json(),
    ]);

    expect([unknown.status, wrongPassword.status]).toStrictEqual([401, 401]);
    expect(unknownBody).toStrictEqual(wrongBody);
  });

  /**
   * Kode OTP benar untuk nomor terdaftar, tanpa bergantung pada send-otp tanpa
   * sesi: pemilik nomor (login) meminta kode, lalu request lain memakainya.
   */
  const validCodeForRegistered = async (phone: string) => {
    const auth = makeAuth();
    const cookie = await signUpWithPhone(auth, phone);
    await sendOtp(auth, phone, { cookie });
    return { auth, code: await storedOtp(phone) };
  };

  it("verify nomor terdaftar tanpa updatePhoneNumber, kode benar → 4xx tanpa cookie sesi", async () => {
    const { auth, code } = await validCodeForRegistered(E164_ID);

    const response = await postTo(auth, "/phone-number/verify", {
      body: { code, phoneNumber: E164_ID },
    });

    expect({
      clientError: isClientError(response.status),
      session: setsSessionCookie(response),
    }).toStrictEqual({ clientError: true, session: false });
  });

  it("verify nomor terdaftar milik pengguna 2FA → 4xx tanpa cookie sesi", async () => {
    const { auth, code } = await validCodeForRegistered(E164_ID);
    await handle.db.execute(sql`update "user" set two_factor_enabled = true`);

    const response = await postTo(auth, "/phone-number/verify", {
      body: { code, phoneNumber: E164_ID },
    });

    expect({
      clientError: isClientError(response.status),
      session: setsSessionCookie(response),
    }).toStrictEqual({ clientError: true, session: false });
  });

  it("verify disableSession tanpa updatePhoneNumber → 4xx tanpa cookie sesi", async () => {
    const { auth, code } = await validCodeForRegistered(E164_ID);

    const response = await postTo(auth, "/phone-number/verify", {
      body: { code, disableSession: true, phoneNumber: E164_ID },
    });

    expect({
      clientError: isClientError(response.status),
      session: setsSessionCookie(response),
    }).toStrictEqual({ clientError: true, session: false });
  });

  const usersWithPhone = async (phone: string): Promise<number> => {
    const result = await handle.db.execute<{ total: number }>(
      sql`select count(*)::int as total from "user" where phone_number = ${phone}`
    );
    return result.rows[0]?.total ?? 0;
  };

  it("sign-up email dengan phoneNumber → nomor tidak tersimpan", async () => {
    const auth = makeAuth();

    await signUpClaimingPhone(auth, LOCAL_ID);

    await expect(usersWithPhone(E164_ID)).resolves.toBe(0);
  });

  it("nomor dari sign-up tanpa OTP tidak bisa dipakai sign-in/phone-number", async () => {
    const auth = makeAuth();
    await signUpClaimingPhone(auth, E164_ID);

    const response = await postTo(auth, "/sign-in/phone-number", {
      body: { password: PASSWORD, phoneNumber: E164_ID },
    });

    expect({
      clientError: isClientError(response.status),
      session: setsSessionCookie(response),
    }).toStrictEqual({ clientError: true, session: false });
  });

  it("nomor dari sign-up tanpa OTP: send-otp tanpa sesi tidak mengirim", async () => {
    const auth = makeAuth();
    await signUpClaimingPhone(auth, E164_ID);
    outbox.clear();

    await sendOtp(auth, E164_ID);

    expect(outbox.list()).toStrictEqual([]);
  });

  it("sign-up dengan nomor yang sudah dipakai → status sama dengan nomor baru", async () => {
    const auth = makeAuth();
    await signUpClaimingPhone(auth, E164_ID);

    const taken = await signUpClaimingPhone(auth, E164_ID);
    const fresh = await signUpClaimingPhone(auth, OTHER_ID);

    expect(taken.status).toBe(fresh.status);
  });

  it("rate limit send-otp aktif di staging: panggilan ke-4 → 429", async () => {
    const auth = makeAuth({ APP_ENV: "staging" });
    const cookie = await signUp(auth);
    const ip = nextIp();
    // Berurutan (rekursif) agar hitungan rate limit deterministik.
    const burst = async (statuses: number[]): Promise<number[]> => {
      if (statuses.length > PHONE_SEND_LIMIT) {
        return statuses;
      }
      const response = await sendOtp(auth, E164_ID, { cookie, ip });
      return burst([...statuses, response.status]);
    };
    const statuses = await burst([]);

    expect(statuses.slice(0, PHONE_SEND_LIMIT)).toStrictEqual([200, 200, 200]);
    expect(statuses.at(-1)).toBe(HTTP_TOO_MANY_REQUESTS);
    expect(outbox.list()).toHaveLength(PHONE_SEND_LIMIT);
  });

  it("rate limit verify di staging: 10 percobaan per IP per menit, ke-11 → 429 + X-Retry-After", async () => {
    const auth = makeAuth({ APP_ENV: "staging" });
    const cookie = await signUp(auth);
    const ip = nextIp();

    const { last, statuses } = await burstFrom(
      PHONE_VERIFY_LIMIT + 1,
      wrongVerify(auth, ip, cookie)
    );

    expect(statuses.slice(0, PHONE_VERIFY_LIMIT)).not.toContain(
      HTTP_TOO_MANY_REQUESTS
    );
    expect(statuses.at(-1)).toBe(HTTP_TOO_MANY_REQUESTS);
    expect(Number(last?.headers.get("x-retry-after"))).toBeGreaterThan(0);
  });

  it("rate limit verify di staging tidak memakai batas 3/menit /phone-number/*", async () => {
    const auth = makeAuth({ APP_ENV: "staging" });
    const ip = nextIp();

    const { statuses } = await burstFrom(
      PHONE_SEND_LIMIT + 1,
      wrongVerify(auth, ip)
    );

    expect(statuses).not.toContain(HTTP_TOO_MANY_REQUESTS);
  });

  it("verify memakai hitungan sendiri: send-otp habis di IP yang sama tidak memblokir verify", async () => {
    const auth = makeAuth({ APP_ENV: "staging" });
    const cookie = await signUp(auth);
    const ip = nextIp();

    const sends = await burstFrom(PHONE_SEND_LIMIT + 1, () =>
      sendOtp(auth, E164_ID, { cookie, ip })
    );
    const verify = await postTo(auth, "/phone-number/verify", {
      body: {
        code: outbox.latestFor(E164_ID)?.code,
        phoneNumber: E164_ID,
        updatePhoneNumber: true,
      },
      cookie,
      ip,
    });

    expect(sends.statuses.at(-1)).toBe(HTTP_TOO_MANY_REQUESTS);
    expect(verify.status).toBe(200);
  });

  it("send-otp tetap 3/menit per IP di staging (aturan verify tidak melonggarkannya)", async () => {
    const auth = makeAuth({ APP_ENV: "staging" });
    const cookie = await signUp(auth);
    const ip = nextIp();

    const { last, statuses } = await burstFrom(PHONE_SEND_LIMIT + 1, () =>
      sendOtp(auth, OTHER_ID, { cookie, ip })
    );

    expect(statuses).toStrictEqual([200, 200, 200, HTTP_TOO_MANY_REQUESTS]);
    expect(Number(last?.headers.get("x-retry-after"))).toBeGreaterThan(0);
  });

  it("development: rate limit IP mati, verify ke-11 dari IP sama bukan 429", async () => {
    const auth = makeAuth();
    const ip = nextIp();

    const { statuses } = await burstFrom(
      PHONE_VERIFY_LIMIT + 1,
      wrongVerify(auth, ip)
    );

    expect(statuses).not.toContain(HTTP_TOO_MANY_REQUESTS);
  });
});

/** Respons dibaca utuh agar status, header relevan, dan body bisa dibandingkan. */
const snapshotResponse = async (response: Response) => ({
  body: await response.text(),
  contentType: response.headers.get("content-type"),
  setsCookie: response.headers.getSetCookie().length > 0,
  status: response.status,
});

const requestReset = (auth: TestAuth, phoneNumber: string) =>
  postTo(auth, "/phone-number/request-password-reset", {
    body: { phoneNumber },
  });

/** Pengirim yang menahan `sendOtp` sampai `release()` dipanggil. */
const gatedSender = () => {
  const gate = Promise.withResolvers<undefined>();
  const calls = vi.fn<PhoneSender["sendOtp"]>();
  const wrap = (sender: PhoneSender): PhoneSender => ({
    ...sender,
    sendOtp: async (input) => {
      calls(input);
      await gate.promise;
      await sender.sendOtp(input);
    },
  });
  return { calls, release: () => gate.resolve(undefined), wrap };
};

describe("request-password-reset telepon tanpa oracle nomor (B7b)", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;
  let outbox: Outbox;

  const makeAuth = (
    options: Pick<
      Parameters<typeof createAuth>[0],
      "onPasswordResetOtpError" | "waitUntil"
    > = {},
    wrapSender: (sender: PhoneSender) => PhoneSender = (sender) => sender
  ) =>
    createAuth({
      db: handle.db,
      env: BASE_ENV,
      phoneSender: wrapSender(createPhoneSender({ env: BASE_ENV, outbox })),
      ...options,
    });

  /** Daftarkan + verifikasi nomor lewat OTP; outbox dikosongkan sesudahnya. */
  const registerPhone = async (auth: TestAuth, phone: string) => {
    const cookie = await signUp(auth);
    await sendOtp(auth, phone, { cookie });
    const response = await postTo(auth, "/phone-number/verify", {
      body: {
        code: outbox.latestFor(phone)?.code,
        phoneNumber: phone,
        updatePhoneNumber: true,
      },
      cookie,
    });
    if (response.status !== 200) {
      throw new Error(`verifikasi nomor gagal: HTTP ${response.status}`);
    }
    outbox.clear();
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

  it("nomor terdaftar dan tidak terdaftar → status, body, dan header identik", async () => {
    const pending: Promise<unknown>[] = [];
    const auth = makeAuth({ waitUntil: (promise) => pending.push(promise) });
    await registerPhone(auth, E164_ID);

    const registered = await snapshotResponse(
      await requestReset(auth, E164_ID)
    );
    const unregistered = await snapshotResponse(
      await requestReset(auth, OTHER_ID)
    );

    expect(registered).toStrictEqual(unregistered);
    expect(registered).toMatchObject({ setsCookie: false, status: 200 });
    expect(JSON.parse(registered.body)).toStrictEqual({ status: true });
    await Promise.all(pending);
    expect(outbox.list().map((entry) => entry.to)).toStrictEqual([E164_ID]);
  });

  it("respons nomor terdaftar tidak menunggu pengiriman (dijadwalkan lewat waitUntil)", async () => {
    const pending: Promise<unknown>[] = [];
    const gated = gatedSender();
    await registerPhone(makeAuth(), E164_ID);
    const auth = makeAuth(
      { waitUntil: (promise) => pending.push(promise) },
      gated.wrap
    );

    // Pengiriman masih tertahan saat respons sudah selesai.
    const response = await requestReset(auth, E164_ID);

    expect(response.status).toBe(200);
    expect(gated.calls).toHaveBeenCalledOnce();
    expect(pending).toHaveLength(1);
    expect(outbox.list()).toStrictEqual([]);

    gated.release();
    await Promise.all(pending);

    expect(outbox.latestFor(E164_ID)?.code).toMatch(SIX_DIGITS);
  });

  it("nomor tidak terdaftar tidak pernah memanggil penyedia", async () => {
    const pending: Promise<unknown>[] = [];
    const gated = gatedSender();
    const auth = makeAuth(
      { waitUntil: (promise) => pending.push(promise) },
      gated.wrap
    );

    const response = await requestReset(auth, OTHER_ID);

    expect(response.status).toBe(200);
    gated.release();
    await Promise.all(pending);
    expect(gated.calls).not.toHaveBeenCalled();
    expect(outbox.list()).toStrictEqual([]);
  });

  it.each(PHONE_ERROR_CASES.map(([phoneCode]) => phoneCode))(
    "PhoneError %s saat kirim (tanpa waitUntil) → tetap 200 identik + callback error",
    async (phoneCode) => {
      const onPasswordResetOtpError = vi.fn<(error: unknown) => void>();
      const auth = makeAuth({ onPasswordResetOtpError });
      await registerPhone(auth, E164_ID);
      const failing = makeAuth(
        { onPasswordResetOtpError },
        failingSender(phoneCode)
      );

      const registered = await snapshotResponse(
        await requestReset(failing, E164_ID)
      );
      const unregistered = await snapshotResponse(
        await requestReset(failing, OTHER_ID)
      );

      expect(registered).toStrictEqual(unregistered);
      expect(registered.status).toBe(200);
      expect(registered.body).not.toContain("21211");
      expect(onPasswordResetOtpError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ code: phoneCode })
      );
    }
  );

  it("pengiriman latar yang gagal tidak menolak promise waitUntil", async () => {
    const pending: Promise<unknown>[] = [];
    const onPasswordResetOtpError = vi.fn<(error: unknown) => void>();
    const auth = makeAuth();
    await registerPhone(auth, E164_ID);
    const failing = makeAuth(
      {
        onPasswordResetOtpError,
        waitUntil: (promise) => pending.push(promise),
      },
      failingSender("PROVIDER_ERROR")
    );

    const response = await requestReset(failing, E164_ID);

    expect(response.status).toBe(200);
    await expect(Promise.all(pending)).resolves.toBeDefined();
    expect(onPasswordResetOtpError).toHaveBeenCalledOnce();
  });
});

describe(otpChannelFrom, () => {
  it.each([
    [{ headers: new Headers({ [OTP_CHANNEL_HEADER]: "sms" }) }, "sms"],
    [
      { headers: new Headers({ [OTP_CHANNEL_HEADER]: "whatsapp" }) },
      "whatsapp",
    ],
    [{ headers: new Headers({ [OTP_CHANNEL_HEADER]: "SMS" }) }, "whatsapp"],
    [{ headers: new Headers() }, "whatsapp"],
    [{ headers: undefined }, "whatsapp"],
    [undefined, "whatsapp"],
  ])("%o → %s", (ctx, expected) => {
    expect(otpChannelFrom(ctx)).toBe(expected);
  });
});
