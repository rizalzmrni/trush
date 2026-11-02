import { createTestDb } from "@trush/db/testing";
import { createOutbox, createPhoneSender } from "@trush/phone";
import type { Outbox, PhoneLogger, PhoneSender } from "@trush/phone";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_BASE_PATH, createAuth } from "./auth";
import type { AuthEnv } from "./auth";
import { createOtpRateLimiter, OTP_RATE_RULES } from "./otp-rate-limit";
import type { OtpRateLimiter } from "./otp-rate-limit";
import { PHONE_OTP_EXPIRES_SECONDS } from "./phone-step-up";

// Step-up password tambah/ganti nomor (B11). Semua nilai palsu; pengirim
// telepon driver memory, fetch keluar (Turnstile, HIBP) di-mock.
const ORIGIN = "http://localhost:5173";
const SESSION_COOKIE = "__Secure-better-auth.session_token";
const PASSWORD = "kata-sandi-uji-yang-cukup-panjang-42";
const WRONG_PASSWORD = "kata-sandi-salah-yang-juga-panjang-7";
const NUMBER_A = "+6281234567890";
const NUMBER_B = "+6281299998888";
const NUMBER_C = "+6281311112222";
const STEP_UP_MAX = OTP_RATE_RULES.stepUp.max;
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const MS_PER_SECOND = 1000;
const PASSWORD_REQUIRED = { code: "PASSWORD_REQUIRED" };
const INVALID_PASSWORD = { code: "INVALID_PASSWORD" };
const PASSWORD_ATTEMPTS_LIMITED = { code: "PASSWORD_ATTEMPTS_LIMITED" };

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

// IP berbeda per request: batas per IP better-auth (aktif di staging) bukan
// yang diuji, kecuali test yang memberi `ip` sendiri.
let ipCounter = 0;
const nextIp = (): string => {
  ipCounter += 1;
  return `192.0.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
};

let emailCounter = 0;
const nextEmail = (): string => {
  emailCounter += 1;
  return `step-up-${emailCounter}@example.test`;
};

type TestAuth = ReturnType<typeof createAuth>;

interface PostOptions {
  body?: unknown;
  cookie?: string;
  ip?: string;
}

const postTo = (
  auth: TestAuth,
  path: string,
  { body = {}, cookie, ip = nextIp() }: PostOptions
): Promise<Response> => {
  const headers = new Headers({
    "cf-connecting-ip": ip,
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

const signUp = async (auth: TestAuth): Promise<string> => {
  const response = await postTo(auth, "/sign-up/email", {
    body: { email: nextEmail(), name: "Pengguna Step-up", password: PASSWORD },
  });
  const raw = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (!raw) {
    throw new Error(`cookie sesi tidak di-set (HTTP ${response.status})`);
  }
  return raw.split(";")[0] ?? "";
};

/** send-otp dengan sesi; `currentPassword` hanya dikirim bila diberikan. */
const sendOtp = (
  auth: TestAuth,
  cookie: string,
  phoneNumber: string,
  currentPassword?: string
) =>
  postTo(auth, "/phone-number/send-otp", {
    body:
      currentPassword === undefined
        ? { phoneNumber }
        : { currentPassword, phoneNumber },
    cookie,
  });

const verify = (
  auth: TestAuth,
  cookie: string,
  phoneNumber: string,
  code: string | undefined
) =>
  postTo(auth, "/phone-number/verify", {
    body: { code, phoneNumber, updatePhoneNumber: true },
    cookie,
  });

/**
 * `timestamp` tanpa zona dari query mentah berupa teks UTC (drizzle menulis
 * `toISOString()`); jangan diparse sebagai waktu lokal.
 */
const utcMillis = (value: string | Date | undefined): number => {
  if (value === undefined) {
    return Number.NaN;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return new Date(`${value.replace(" ", "T")}Z`).getTime();
};

/** Ganti digit terakhir agar kode pasti salah. */
const wrongCodeFor = (code: string | undefined): string =>
  (code ?? "000000").replace(/\d$/u, (digit) =>
    String((Number(digit) + 1) % 10)
  );

const userIdOf = async (auth: TestAuth, cookie: string): Promise<string> => {
  const session = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  if (!session) {
    throw new Error("sesi tidak ditemukan");
  }
  return session.user.id;
};

/** Nomor seluler ID unik dan valid: +62812 + 8 digit. */
const phoneAtIndex = (index: number): string =>
  `+62812${String(20_000_000 + index).slice(-8)}`;

const changePassword = (
  auth: TestAuth,
  cookie: string,
  ip: string,
  currentPassword: string
) =>
  postTo(auth, "/change-password", {
    body: { currentPassword, newPassword: `${PASSWORD}-baru` },
    cookie,
    ip,
  });

/** Limiter yang meneruskan semua kunci KECUALI step-up (uji kuota lain). */
const withoutStepUp = (limiter: OtpRateLimiter): OtpRateLimiter => ({
  consume: (requests) =>
    limiter.consume(
      requests.filter((request) => !request.key.startsWith("step-up:"))
    ),
});

describe("step-up password send-otp/verify (B11)", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;
  let outbox: Outbox;

  const makeAuth = ({
    env = {},
    limiter = "explicit",
    phoneLogger,
  }: {
    env?: Partial<AuthEnv>;
    limiter?: "default" | "explicit";
    phoneLogger?: PhoneLogger;
  } = {}) => {
    const fullEnv = { ...BASE_ENV, ...env };
    const phoneSender: PhoneSender = createPhoneSender({
      env: fullEnv,
      logger: phoneLogger,
      outbox,
    });
    return createAuth({
      db: handle.db,
      env: fullEnv,
      phoneLogger,
      phoneSender,
      ...(limiter === "explicit"
        ? { otpRateLimiter: createOtpRateLimiter(handle.db) }
        : {}),
    });
  };

  const grantsOf = async (userId: string) => {
    const result = await handle.db.execute<{
      expires_at: string | Date;
      value: string;
    }>(
      sql`select value, expires_at from "verification" where identifier = ${`phone-step-up:${userId}`}`
    );
    return result.rows;
  };

  const quotaKeys = async (): Promise<string[]> => {
    const result = await handle.db.execute<{ key: string }>(
      sql`select key from "otp_rate_limit" order by key`
    );
    return result.rows.map((row) => row.key);
  };

  const storedPhone = async (userId: string) => {
    const result = await handle.db.execute<{
      phone_number: string | null;
      phone_number_verified: boolean | null;
    }>(
      sql`select phone_number, phone_number_verified from "user" where id = ${userId}`
    );
    return result.rows[0];
  };

  const expireGrant = async (userId: string) => {
    await handle.db.execute(
      sql`update "verification" set expires_at = now() - interval '1 second' where identifier = ${`phone-step-up:${userId}`}`
    );
  };

  /** Ubah nomor di grant (tanpa menyentuh OTP), untuk menguji kecocokan. */
  const setGrantNumber = async (userId: string, phoneNumber: string) => {
    await handle.db.execute(
      sql`update "verification" set value = ${phoneNumber} where identifier = ${`phone-step-up:${userId}`}`
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

  it.each([
    ["tanpa currentPassword", undefined],
    ["currentPassword kosong", ""],
  ])(
    "nomor pertama %s → 403 PASSWORD_REQUIRED, tanpa OTP, kuota, atau grant",
    async (_label, currentPassword) => {
      const auth = makeAuth();
      const cookie = await signUp(auth);
      const userId = await userIdOf(auth, cookie);

      const response = await sendOtp(auth, cookie, NUMBER_A, currentPassword);

      expect(response.status).toBe(HTTP_FORBIDDEN);
      await expect(response.json()).resolves.toMatchObject(PASSWORD_REQUIRED);
      expect(outbox.list()).toHaveLength(0);
      await expect(quotaKeys()).resolves.toStrictEqual([]);
      await expect(grantsOf(userId)).resolves.toHaveLength(0);
    }
  );

  it("password salah → 400 INVALID_PASSWORD, tanpa OTP dan tanpa kuota OTP", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    const userId = await userIdOf(auth, cookie);

    const response = await sendOtp(auth, cookie, NUMBER_A, WRONG_PASSWORD);

    expect(response.status).toBe(HTTP_BAD_REQUEST);
    await expect(response.json()).resolves.toMatchObject(INVALID_PASSWORD);
    expect(outbox.list()).toHaveLength(0);
    // Hanya percobaan step-up yang terhitung; kuota OTP utuh.
    await expect(quotaKeys()).resolves.toStrictEqual([
      `step-up:user:${userId}`,
    ]);
    await expect(grantsOf(userId)).resolves.toHaveLength(0);
  });

  it("password benar → OTP terkirim dan grant (nomor E.164, 300 detik)", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    const userId = await userIdOf(auth, cookie);
    const before = Date.now();

    const response = await sendOtp(auth, cookie, "0812-3456-7890", PASSWORD);
    const after = Date.now();

    expect(response.status).toBe(HTTP_OK);
    expect(outbox.latestFor(NUMBER_A)?.code).toMatch(/^\d{6}$/u);
    const grants = await grantsOf(userId);
    expect(grants.map((grant) => grant.value)).toStrictEqual([NUMBER_A]);
    // Kedaluwarsa = waktu request + 300 detik (presisi detik di Postgres).
    const expiresAt = utcMillis(grants[0]?.expires_at);
    const lifetimeMs = PHONE_OTP_EXPIRES_SECONDS * MS_PER_SECOND;
    expect(
      expiresAt >= before + lifetimeMs - MS_PER_SECOND &&
        expiresAt <= after + lifetimeMs + MS_PER_SECOND
    ).toBeTruthy();
  });

  it("umur grant = umur OTP (300 detik)", () => {
    expect(PHONE_OTP_EXPIRES_SECONDS).toBe(300);
  });

  it("verify dengan grant → nomor tersimpan, grant terhapus, replay 403", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    const userId = await userIdOf(auth, cookie);
    await sendOtp(auth, cookie, NUMBER_A, PASSWORD);
    const code = outbox.latestFor(NUMBER_A)?.code;

    const verified = await verify(auth, cookie, NUMBER_A, code);
    const replay = await verify(auth, cookie, NUMBER_A, code);

    expect(verified.status).toBe(HTTP_OK);
    await expect(storedPhone(userId)).resolves.toStrictEqual({
      phone_number: NUMBER_A,
      phone_number_verified: true,
    });
    await expect(grantsOf(userId)).resolves.toHaveLength(0);
    expect(replay.status).toBe(HTTP_FORBIDDEN);
    await expect(replay.json()).resolves.toMatchObject(PASSWORD_REQUIRED);
  });

  it("ganti nomor: tanpa password 403, password benar → nomor baru tersimpan", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    const userId = await userIdOf(auth, cookie);
    await sendOtp(auth, cookie, NUMBER_A, PASSWORD);
    await verify(auth, cookie, NUMBER_A, outbox.latestFor(NUMBER_A)?.code);

    const withoutPassword = await sendOtp(auth, cookie, NUMBER_B);
    const sentBeforeStepUp = outbox.list().length;
    const withPassword = await sendOtp(auth, cookie, NUMBER_B, PASSWORD);
    const verified = await verify(
      auth,
      cookie,
      NUMBER_B,
      outbox.latestFor(NUMBER_B)?.code
    );

    expect(withoutPassword.status).toBe(HTTP_FORBIDDEN);
    expect(sentBeforeStepUp).toBe(1);
    expect(withPassword.status).toBe(HTTP_OK);
    expect(verified.status).toBe(HTTP_OK);
    await expect(storedPhone(userId)).resolves.toMatchObject({
      phone_number: NUMBER_B,
    });
  });

  it("verify kedua dengan kode baru tanpa grant → 403 (grant sekali pakai)", async () => {
    const auth = makeAuth();
    const victim = await signUp(auth);
    const helper = await signUp(auth);
    const victimId = await userIdOf(auth, victim);
    await sendOtp(auth, victim, NUMBER_A, PASSWORD);
    await verify(auth, victim, NUMBER_A, outbox.latestFor(NUMBER_A)?.code);
    // Kode baru untuk nomor lain lewat akun lain; grant korban sudah habis.
    await sendOtp(auth, helper, NUMBER_C, PASSWORD);

    const second = await verify(
      auth,
      victim,
      NUMBER_C,
      outbox.latestFor(NUMBER_C)?.code
    );

    expect(second.status).toBe(HTTP_FORBIDDEN);
    await expect(second.json()).resolves.toMatchObject(PASSWORD_REQUIRED);
    await expect(storedPhone(victimId)).resolves.toMatchObject({
      phone_number: NUMBER_A,
    });
  });

  it("grant terikat nomor: grant untuk A, verify B → 403 tanpa mengubah akun", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    const other = await signUp(auth);
    const userId = await userIdOf(auth, cookie);
    await sendOtp(auth, cookie, NUMBER_A, PASSWORD);
    await sendOtp(auth, other, NUMBER_B, PASSWORD);

    const response = await verify(
      auth,
      cookie,
      NUMBER_B,
      outbox.latestFor(NUMBER_B)?.code
    );

    expect(response.status).toBe(HTTP_FORBIDDEN);
    await expect(response.json()).resolves.toMatchObject(PASSWORD_REQUIRED);
    await expect(storedPhone(userId)).resolves.toMatchObject({
      phone_number: null,
    });
    // Grant A tetap ada: verify A dengan kodenya masih berhasil.
    const verifiedA = await verify(
      auth,
      cookie,
      NUMBER_A,
      outbox.latestFor(NUMBER_A)?.code
    );
    expect(verifiedA.status).toBe(HTTP_OK);
  });

  it("serangan akun kedua: OTP diminta akun B (nomor X), diverifikasi sesi A → 403", async () => {
    const auth = makeAuth();
    const victim = await signUp(auth);
    const attacker = await signUp(auth);
    const victimId = await userIdOf(auth, victim);
    const attackerId = await userIdOf(auth, attacker);
    await sendOtp(auth, attacker, NUMBER_C, PASSWORD);

    const response = await verify(
      auth,
      victim,
      NUMBER_C,
      outbox.latestFor(NUMBER_C)?.code
    );

    expect(response.status).toBe(HTTP_FORBIDDEN);
    await expect(response.json()).resolves.toMatchObject(PASSWORD_REQUIRED);
    await expect(storedPhone(victimId)).resolves.toMatchObject({
      phone_number: null,
    });
    // Grant penyerang tidak dikonsumsi oleh percobaan lewat sesi korban.
    await expect(grantsOf(attackerId)).resolves.toHaveLength(1);
  });

  it("password benar berikutnya menggantikan grant lama", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    const userId = await userIdOf(auth, cookie);
    await sendOtp(auth, cookie, NUMBER_A, PASSWORD);
    const codeA = outbox.latestFor(NUMBER_A)?.code;

    await sendOtp(auth, cookie, NUMBER_B, PASSWORD);
    const oldNumber = await verify(auth, cookie, NUMBER_A, codeA);

    const grants = await grantsOf(userId);
    expect(grants.map((grant) => grant.value)).toStrictEqual([NUMBER_B]);
    expect(oldNumber.status).toBe(HTTP_FORBIDDEN);
  });

  it("grant kedaluwarsa → 403 PASSWORD_REQUIRED, nomor tidak tersimpan", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    const userId = await userIdOf(auth, cookie);
    await sendOtp(auth, cookie, NUMBER_A, PASSWORD);
    await expireGrant(userId);

    const expired = await verify(
      auth,
      cookie,
      NUMBER_A,
      outbox.latestFor(NUMBER_A)?.code
    );

    expect(expired.status).toBe(HTTP_FORBIDDEN);
    await expect(expired.json()).resolves.toMatchObject(PASSWORD_REQUIRED);
    await expect(storedPhone(userId)).resolves.toMatchObject({
      phone_number: null,
    });
  });

  it("grant tak cocok ditolak sebelum kode diperiksa (percobaan kode tidak terpakai)", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    const userId = await userIdOf(auth, cookie);
    await sendOtp(auth, cookie, NUMBER_A, PASSWORD);
    const code = outbox.latestFor(NUMBER_A)?.code;
    await setGrantNumber(userId, NUMBER_B);
    // Melebihi allowedAttempts (3): bila kode diperiksa, OTP akan hangus.
    const rejected = [
      await verify(auth, cookie, NUMBER_A, wrongCodeFor(code)),
      await verify(auth, cookie, NUMBER_A, wrongCodeFor(code)),
      await verify(auth, cookie, NUMBER_A, wrongCodeFor(code)),
      await verify(auth, cookie, NUMBER_A, wrongCodeFor(code)),
    ].map((response) => response.status);

    await setGrantNumber(userId, NUMBER_A);
    const restored = await verify(auth, cookie, NUMBER_A, code);

    expect(rejected).toStrictEqual([
      HTTP_FORBIDDEN,
      HTTP_FORBIDDEN,
      HTTP_FORBIDDEN,
      HTTP_FORBIDDEN,
    ]);
    expect(restored.status).toBe(HTTP_OK);
  });

  it("kode salah tidak menghapus grant; kode benar sesudahnya berhasil", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    const userId = await userIdOf(auth, cookie);
    await sendOtp(auth, cookie, NUMBER_A, PASSWORD);
    const code = outbox.latestFor(NUMBER_A)?.code;

    const wrong = await verify(auth, cookie, NUMBER_A, wrongCodeFor(code));
    const grantsAfterWrong = await grantsOf(userId);
    const right = await verify(auth, cookie, NUMBER_A, code);

    expect(wrong.status).toBe(HTTP_BAD_REQUEST);
    expect(grantsAfterWrong).toHaveLength(1);
    expect(right.status).toBe(HTTP_OK);
  });

  it("kuota step-up: 10 percobaan (salah) per pengguna, ke-11 walau benar → 429 + Retry-After", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    const userId = await userIdOf(auth, cookie);
    const attempt = async (statuses: number[]): Promise<number[]> => {
      if (statuses.length >= STEP_UP_MAX) {
        return statuses;
      }
      const response = await sendOtp(auth, cookie, NUMBER_A, WRONG_PASSWORD);
      return attempt([...statuses, response.status]);
    };

    const statuses = await attempt([]);
    const limited = await sendOtp(auth, cookie, NUMBER_A, PASSWORD);

    expect(statuses).toStrictEqual(
      Array.from({ length: STEP_UP_MAX }, () => HTTP_BAD_REQUEST)
    );
    expect(limited.status).toBe(HTTP_TOO_MANY_REQUESTS);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    await expect(limited.json()).resolves.toMatchObject(
      PASSWORD_ATTEMPTS_LIMITED
    );
    expect({
      grants: await grantsOf(userId),
      keys: await quotaKeys(),
      sent: outbox.list().length,
    }).toStrictEqual({ grants: [], keys: [`step-up:user:${userId}`], sent: 0 });
  });

  it("kuota step-up per pengguna: pengguna lain tidak ikut terblokir", async () => {
    const auth = makeAuth();
    const spender = await signUp(auth);
    const other = await signUp(auth);
    const spend = async (left: number): Promise<void> => {
      if (left === 0) {
        return;
      }
      await sendOtp(auth, spender, NUMBER_A, WRONG_PASSWORD);
      await spend(left - 1);
    };
    await spend(STEP_UP_MAX + 1);

    const response = await sendOtp(auth, other, NUMBER_B, PASSWORD);

    expect(response.status).toBe(HTTP_OK);
  });

  it("percobaan tanpa password tidak memakan kuota step-up", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    const probe = async (left: number): Promise<void> => {
      if (left === 0) {
        return;
      }
      await sendOtp(auth, cookie, NUMBER_A);
      await probe(left - 1);
    };
    await probe(STEP_UP_MAX + 1);

    const keysAfterProbe = await quotaKeys();
    const response = await sendOtp(auth, cookie, NUMBER_A, PASSWORD);

    expect(keysAfterProbe).toStrictEqual([]);
    expect(response.status).toBe(HTTP_OK);
  });

  it("staging (limiter bawaan): kuota step-up aktif", async () => {
    const auth = makeAuth({ env: { APP_ENV: "staging" }, limiter: "default" });
    const cookie = await signUp(auth);
    const spend = async (left: number): Promise<void> => {
      if (left === 0) {
        return;
      }
      await sendOtp(auth, cookie, NUMBER_A, WRONG_PASSWORD);
      await spend(left - 1);
    };
    await spend(STEP_UP_MAX);

    const limited = await sendOtp(auth, cookie, NUMBER_A, PASSWORD);

    expect(limited.status).toBe(HTTP_TOO_MANY_REQUESTS);
    await expect(limited.json()).resolves.toMatchObject(
      PASSWORD_ATTEMPTS_LIMITED
    );
  });

  it("development (tanpa limiter): kuota step-up mati", async () => {
    const auth = makeAuth({ limiter: "default" });
    const cookie = await signUp(auth);
    const spend = async (left: number): Promise<void> => {
      if (left === 0) {
        return;
      }
      await sendOtp(auth, cookie, NUMBER_A, WRONG_PASSWORD);
      await spend(left - 1);
    };
    await spend(STEP_UP_MAX + 1);

    const response = await sendOtp(auth, cookie, NUMBER_A, PASSWORD);

    expect(response.status).toBe(HTTP_OK);
  });

  it("akun tanpa password credential → selalu INVALID_PASSWORD (fail closed)", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);
    const userId = await userIdOf(auth, cookie);
    await handle.db.execute(
      sql`update "account" set password = null where user_id = ${userId}`
    );

    const response = await sendOtp(auth, cookie, NUMBER_A, PASSWORD);

    expect(response.status).toBe(HTTP_BAD_REQUEST);
    await expect(response.json()).resolves.toMatchObject(INVALID_PASSWORD);
    expect(outbox.list()).toHaveLength(0);
  });

  it("send-otp tanpa sesi tidak meminta password (tetap 200 tanpa kirim)", async () => {
    const auth = makeAuth();

    const response = await postTo(auth, "/phone-number/send-otp", {
      body: { phoneNumber: NUMBER_A },
    });

    expect(response.status).toBe(HTTP_OK);
    expect(outbox.list()).toHaveLength(0);
  });

  it("password tidak bocor ke respons, DB, outbox, atau log", async () => {
    const logged: string[] = [];
    const logger: PhoneLogger = {
      info: (message, properties) => {
        logged.push(`${message} ${JSON.stringify(properties ?? {})}`);
      },
    };
    const consoleCalls: string[] = [];
    for (const method of ["debug", "error", "info", "log", "warn"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        consoleCalls.push(args.map(String).join(" "));
      });
    }
    const auth = makeAuth({
      env: { PHONE_DRIVER: "log" },
      phoneLogger: logger,
    });
    const cookie = await signUp(auth);

    const wrong = await sendOtp(auth, cookie, NUMBER_A, WRONG_PASSWORD);
    const right = await sendOtp(auth, cookie, NUMBER_A, PASSWORD);
    const tables = await handle.db.execute<{ dump: string }>(
      sql`select (select coalesce(string_agg(value, ' '), '') from "verification") || ' ' || (select coalesce(string_agg(key, ' '), '') from "otp_rate_limit") as dump`
    );
    const haystack = [
      await wrong.text(),
      await right.text(),
      JSON.stringify(wrong.headers.getSetCookie()),
      tables.rows[0]?.dump ?? "",
      JSON.stringify(outbox.list()),
      ...logged,
      ...consoleCalls,
    ].join("\n");

    expect(right.status).toBe(HTTP_OK);
    expect(logged.length).toBeGreaterThan(0);
    expect(haystack).not.toContain(PASSWORD);
    expect(haystack).not.toContain(WRONG_PASSWORD);
  });
});

describe("kuota OTP per pengguna tetap berlaku di belakang step-up", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;
  let outbox: Outbox;

  beforeEach(async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(fakeFetch);
    handle = await createTestDb();
    outbox = createOutbox();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await handle.close();
  });

  // Kuota step-up sama dengan kuota OTP per pengguna (10/jam) dan diperiksa
  // lebih dulu; limiter uji melewati kunci step-up agar kuota OTP sendiri
  // tetap teruji.
  it("tanpa kuota step-up: permintaan ke-11 → 429 OTP_RATE_LIMITED", async () => {
    const auth = createAuth({
      db: handle.db,
      env: BASE_ENV,
      otpRateLimiter: withoutStepUp(createOtpRateLimiter(handle.db)),
      phoneSender: createPhoneSender({ env: BASE_ENV, outbox }),
    });
    const cookie = await signUp(auth);
    const userMax = OTP_RATE_RULES.user.max;
    const send = async (index: number, statuses: number[]) => {
      if (index >= userMax) {
        return statuses;
      }
      const response = await sendOtp(
        auth,
        cookie,
        phoneAtIndex(index),
        PASSWORD
      );
      return send(index + 1, [...statuses, response.status]);
    };

    const statuses = await send(0, []);
    const limited = await sendOtp(
      auth,
      cookie,
      phoneAtIndex(userMax),
      PASSWORD
    );

    expect(statuses).toStrictEqual(
      Array.from({ length: userMax }, () => HTTP_OK)
    );
    expect(limited.status).toBe(HTTP_TOO_MANY_REQUESTS);
    await expect(limited.json()).resolves.toMatchObject({
      code: "OTP_RATE_LIMITED",
    });
    expect(outbox.list()).toHaveLength(userMax);
  });
});

describe("rate limit /change-password", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;

  beforeEach(async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(fakeFetch);
    handle = await createTestDb();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await handle.close();
  });

  const makeAuth = (env: Partial<AuthEnv> = {}) => {
    const fullEnv = { ...BASE_ENV, ...env };
    return createAuth({
      db: handle.db,
      env: fullEnv,
      phoneSender: createPhoneSender({ env: fullEnv, outbox: createOutbox() }),
    });
  };

  it("currentPassword tetap sampai ke /change-password (tidak dibuang)", async () => {
    const auth = makeAuth();
    const cookie = await signUp(auth);

    const response = await changePassword(auth, cookie, nextIp(), PASSWORD);

    expect(response.status).toBe(HTTP_OK);
  });

  it("staging: 5 percobaan per IP per menit, ke-6 → 429", async () => {
    const auth = makeAuth({ APP_ENV: "staging" });
    const cookie = await signUp(auth);
    const ip = nextIp();
    const attempt = async (statuses: number[]): Promise<number[]> => {
      if (statuses.length > 5) {
        return statuses;
      }
      const response = await changePassword(auth, cookie, ip, WRONG_PASSWORD);
      return attempt([...statuses, response.status]);
    };

    const statuses = await attempt([]);
    const otherIp = await changePassword(
      auth,
      cookie,
      nextIp(),
      WRONG_PASSWORD
    );

    expect(statuses.slice(0, 5)).not.toContain(HTTP_TOO_MANY_REQUESTS);
    expect(statuses.at(-1)).toBe(HTTP_TOO_MANY_REQUESTS);
    expect(otherIp.status).not.toBe(HTTP_TOO_MANY_REQUESTS);
  });
});
