import { createTestDb } from "@trush/db/testing";
import { Hono } from "hono";
import type { ErrorHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_BASE_PATH, createAuth } from "./auth";
import type { Auth } from "./auth";
import { requireSession } from "./middleware";
import type { AuthVariables } from "./middleware";

// Nilai palsu; Turnstile kunci uji Cloudflare yang selalu lolos.
const BASE_URL = "http://localhost:8787";
const ORIGIN = "http://localhost:5173";
const SESSION_COOKIE = "__Secure-better-auth.session_token";

type TestDbHandle = Awaited<ReturnType<typeof createTestDb>>;

let handle: TestDbHandle;
let auth: Auth;

/** HTTPException → JSON dengan status aslinya; error lain dilempar ulang. */
const handleError: ErrorHandler = (error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ message: error.message }, error.status);
  }
  throw error;
};

const injectAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    c.set("auth", auth);
    return await next();
  }
);

/** Mini app: pasang instance auth lalu `requireSession`, seperti `apps/api`. */
const buildApp = () => {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.onError(handleError);
  app.use("*", injectAuth);
  app.get("/rahasia", requireSession, (c) =>
    c.json({
      sessionId: c.var.authSession.session.id,
      userId: c.var.authSession.user.id,
    })
  );
  return app;
};

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
  throw new Error(`fetch tak terduga ke ${url.href}`);
};

const signUpCookie = async (): Promise<string> => {
  const response = await auth.handler(
    new Request(`${BASE_URL}${AUTH_BASE_PATH}/sign-up/email`, {
      body: JSON.stringify({
        email: "budi@example.test",
        name: "Budi",
        password: "kata-sandi-uji-yang-cukup-panjang-42",
      }),
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "content-type": "application/json",
        origin: ORIGIN,
        "x-captcha-response": "XXXX.DUMMY.TOKEN.XXXX",
      },
      method: "POST",
    })
  );
  const raw = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (!raw) {
    throw new Error("sign-up tidak memasang cookie sesi");
  }
  return raw.split(";")[0] ?? "";
};

describe(requireSession, () => {
  beforeEach(async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(fakeFetch);
    handle = await createTestDb();
    auth = createAuth({
      db: handle.db,
      env: {
        APP_ENV: "development",
        AUTH_COOKIE_DOMAIN: undefined,
        BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
        BETTER_AUTH_URL: BASE_URL,
        CORS_ORIGINS: [ORIGIN],
        PHONE_ALLOWED_COUNTRIES: ["ID"],
        PHONE_ALLOWLIST: undefined,
        PHONE_DRIVER: "memory",
        TWILIO_ACCOUNT_SID: undefined,
        TWILIO_API_KEY_SECRET: undefined,
        TWILIO_API_KEY_SID: undefined,
        TWILIO_MESSAGING_SERVICE_SID: undefined,
        TWILIO_TEST_ACCOUNT_SID: undefined,
        TWILIO_TEST_AUTH_TOKEN: undefined,
        TWILIO_WHATSAPP_OTP_CONTENT_SID: undefined,
        TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
      },
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await handle.close();
  });

  it("401 tanpa cookie sesi", async () => {
    const response = await buildApp().request("/rahasia");

    expect(response.status).toBe(401);
  });

  it("401 dengan cookie sesi palsu", async () => {
    const response = await buildApp().request("/rahasia", {
      headers: { cookie: `${SESSION_COOKIE}=palsu.palsu` },
    });

    expect(response.status).toBe(401);
  });

  it("mengisi c.var.authSession bila sesi valid", async () => {
    const cookie = await signUpCookie();
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });

    const response = await buildApp().request("/rahasia", {
      headers: { cookie },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      sessionId: session?.session.id,
      userId: session?.user.id,
    });
  });

  it("401 setelah sign-out", async () => {
    const cookie = await signUpCookie();
    await auth.handler(
      new Request(`${BASE_URL}${AUTH_BASE_PATH}/sign-out`, {
        body: "{}",
        headers: { "content-type": "application/json", cookie, origin: ORIGIN },
        method: "POST",
      })
    );

    const response = await buildApp().request("/rahasia", {
      headers: { cookie },
    });

    expect(response.status).toBe(401);
  });
});
