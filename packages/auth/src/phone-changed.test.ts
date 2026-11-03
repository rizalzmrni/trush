import { createTestDb } from "@trush/db/testing";
import { createEmailOutbox, createEmailSender, EmailError } from "@trush/email";
import type { EmailOutbox, EmailSender } from "@trush/email";
import { createOutbox, createPhoneSender } from "@trush/phone";
import type { Outbox } from "@trush/phone";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_BASE_PATH, createAuth } from "./auth";
import type { AuthEnv } from "./auth";
import { TEST_EMAIL_ENV, markEmailVerified } from "./testing";

// Semua nilai palsu; email dan telepon driver memory, fetch keluar di-mock.
const ORIGIN = "http://localhost:5174";
const SESSION_COOKIE = "__Secure-better-auth.session_token";
const PASSWORD = "kata-sandi-uji-yang-cukup-panjang-42";
const FIRST_PHONE = "+6281234567890";
const SECOND_PHONE = "+6281398765432";
const HTTP_OK = 200;

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
  return `198.18.0.${ipCounter % 250}`;
};

let emailCounter = 0;
const nextEmail = (): string => {
  emailCounter += 1;
  return `ganti-nomor-${emailCounter}@example.test`;
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

const requireCookie = (response: Response): string => {
  const raw = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (!raw) {
    throw new Error(`cookie sesi tidak di-set (HTTP ${response.status})`);
  }
  return raw.split(";")[0] ?? "";
};

const signIn = async (auth: TestAuth, email: string): Promise<string> =>
  requireCookie(
    await post(auth, "/sign-in/email", { email, password: PASSWORD })
  );

const sessionOf = (auth: TestAuth, cookie: string) =>
  auth.api.getSession({ headers: new Headers({ cookie }) });

/** Pengguna terverifikasi; mengembalikan email. */
const verifiedUser = async (auth: TestAuth): Promise<string> => {
  const email = nextEmail();
  await post(auth, "/sign-up/email", {
    email,
    name: "Pengguna Nomor",
    password: PASSWORD,
  });
  await markEmailVerified(auth, email);
  return email;
};
/** Pengirim email yang selalu gagal (meniru Resend down). */
const failingEmailSender = (sender: EmailSender): EmailSender => ({
  ...sender,
  send: () =>
    Promise.reject(
      new EmailError("PROVIDER_ERROR", "Gagal menghubungi Resend.")
    ),
});

describe("ganti nomor telepon: sesi lain dicabut + notifikasi email (B16)", () => {
  let handle: Awaited<ReturnType<typeof createTestDb>>;
  let emailOutbox: EmailOutbox;
  let phoneOutbox: Outbox;

  const makeAuth = (
    options: {
      wrapEmail?: (sender: EmailSender) => EmailSender;
      onEmailDeliveryError?: (error: unknown) => void;
    } = {}
  ) => {
    const { onEmailDeliveryError, wrapEmail = (sender) => sender } = options;
    return createAuth({
      db: handle.db,
      emailSender: wrapEmail(
        createEmailSender({ env: BASE_ENV, outbox: emailOutbox })
      ),
      env: BASE_ENV,
      onEmailDeliveryError,
      phoneSender: createPhoneSender({ env: BASE_ENV, outbox: phoneOutbox }),
    });
  };

  /** Step-up password + OTP, lalu verify `updatePhoneNumber` dengan sesi. */
  const changePhone = async (
    auth: TestAuth,
    cookie: string,
    phoneNumber: string
  ): Promise<Response> => {
    await post(
      auth,
      "/phone-number/send-otp",
      { currentPassword: PASSWORD, phoneNumber },
      cookie
    );
    return post(
      auth,
      "/phone-number/verify",
      {
        code: phoneOutbox.latestFor(phoneNumber)?.code,
        phoneNumber,
        updatePhoneNumber: true,
      },
      cookie
    );
  };

  const notificationsFor = (email: string) =>
    emailOutbox
      .list()
      .filter(
        (entry) =>
          entry.to === email && entry.template === "phone-number-changed"
      );

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

  it("menambah nomor: sesi lain dicabut, sesi yang dipakai tetap hidup", async () => {
    const auth = makeAuth();
    const email = await verifiedUser(auth);
    const current = await signIn(auth, email);
    const other = await signIn(auth, email);

    const response = await changePhone(auth, current, FIRST_PHONE);

    expect(response.status).toBe(HTTP_OK);
    await expect(sessionOf(auth, current)).resolves.toMatchObject({
      user: { email, phoneNumber: FIRST_PHONE },
    });
    await expect(sessionOf(auth, other)).resolves.toBeNull();
  });

  it("notifikasi email memuat nomor tersamar, bukan nomor utuh", async () => {
    const auth = makeAuth();
    const email = await verifiedUser(auth);
    const cookie = await signIn(auth, email);

    await changePhone(auth, cookie, FIRST_PHONE);

    const [notification] = notificationsFor(email);
    expect(notificationsFor(email)).toHaveLength(1);
    expect(notification).toMatchObject({
      code: null,
      subject: "Nomor telepon akun trush diubah",
    });
    expect(notification?.body).toContain("****");
    expect(notification?.body).not.toContain(FIRST_PHONE);
  });

  it("mengganti nomor lagi: notifikasi kedua dan sesi baru lain ikut dicabut", async () => {
    const auth = makeAuth();
    const email = await verifiedUser(auth);
    const current = await signIn(auth, email);
    await changePhone(auth, current, FIRST_PHONE);
    const later = await signIn(auth, email);

    const response = await changePhone(auth, current, SECOND_PHONE);

    expect(response.status).toBe(HTTP_OK);
    expect(notificationsFor(email)).toHaveLength(2);
    await expect(sessionOf(auth, later)).resolves.toBeNull();
    await expect(sessionOf(auth, current)).resolves.toMatchObject({
      user: { phoneNumber: SECOND_PHONE },
    });
  });

  it("verify gagal (kode salah): tanpa notifikasi dan sesi lain tetap hidup", async () => {
    const auth = makeAuth();
    const email = await verifiedUser(auth);
    const current = await signIn(auth, email);
    const other = await signIn(auth, email);
    await post(
      auth,
      "/phone-number/send-otp",
      { currentPassword: PASSWORD, phoneNumber: FIRST_PHONE },
      current
    );
    const code = phoneOutbox.latestFor(FIRST_PHONE)?.code;

    const response = await post(
      auth,
      "/phone-number/verify",
      {
        code: code === "000000" ? "111111" : "000000",
        phoneNumber: FIRST_PHONE,
        updatePhoneNumber: true,
      },
      current
    );

    expect(response.status).toBe(400);
    expect(notificationsFor(email)).toHaveLength(0);
    await expect(sessionOf(auth, other)).resolves.not.toBeNull();
  });

  it("email gagal terkirim: nomor tetap tersimpan, error hanya ke onEmailDeliveryError", async () => {
    const onEmailDeliveryError = vi.fn<(error: unknown) => void>();
    const auth = makeAuth({
      onEmailDeliveryError,
      wrapEmail: failingEmailSender,
    });
    const email = await verifiedUser(auth);
    const current = await signIn(auth, email);
    const other = await signIn(auth, email);
    // Email verifikasi saat sign-up juga gagal; hanya hitung notifikasi.
    onEmailDeliveryError.mockClear();

    const response = await changePhone(auth, current, FIRST_PHONE);

    expect(response.status).toBe(HTTP_OK);
    expect(onEmailDeliveryError).toHaveBeenCalledExactlyOnceWith(
      expect.any(EmailError)
    );
    await expect(sessionOf(auth, other)).resolves.toBeNull();
    await expect(sessionOf(auth, current)).resolves.toMatchObject({
      user: { phoneNumber: FIRST_PHONE },
    });
  });
});
