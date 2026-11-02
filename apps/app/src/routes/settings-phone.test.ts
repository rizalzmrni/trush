import { describe, expect, it } from "vitest";

import { TURNSTILE_FIELD } from "../features/auth/form-schema";
import { INTENT_FIELD, PHONE_INTENTS } from "../features/phone/form-schema";
import {
  appRequest,
  createFakeApi,
  createTestContext,
  describeRequest,
  formRequest,
  jsonResponse,
  ME_FIXTURE,
  SESSION_COOKIE,
  TEST_ENV,
} from "../testing/cloudflare";
import type { ApiHandler } from "../testing/cloudflare";
import { action, handle, loader } from "./settings-phone";

const PATH = "/settings/phone";
const E164 = "+6281234567890";
const SEND_FIELDS = {
  [INTENT_FIELD]: PHONE_INTENTS.send,
  [TURNSTILE_FIELD]: "token-turnstile-palsu",
  channel: "whatsapp",
  phoneNumber: "0812-3456-7890",
};

const meWith = (user: Record<string, unknown>) =>
  jsonResponse({ ...ME_FIXTURE, user: { ...ME_FIXTURE.user, ...user } });

const unauthorized = () => new Response(null, { status: 401 });

const routeArgs = (request: Request, handler: ApiHandler) => {
  const api = createFakeApi(handler);
  return {
    api,
    args: {
      context: createTestContext({ api }),
      params: {},
      pattern: PATH,
      request,
      url: new URL(request.url),
    },
  };
};

const settle = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    return await run();
  } catch (error) {
    return error;
  }
};

const runLoader = async (handler: ApiHandler, path = PATH) => {
  const { api, args } = routeArgs(
    appRequest(path, { cookie: SESSION_COOKIE }),
    handler
  );
  return { api, result: await settle(() => loader(args)) };
};

const runAction = async (
  handler: ApiHandler,
  fields: Record<string, string> = SEND_FIELDS
) => {
  const { api, args } = routeArgs(
    formRequest(PATH, fields, SESSION_COOKIE),
    handler
  );
  return { api, result: await settle(() => action(args)) };
};

const SIGN_IN_REDIRECT = {
  location: "/sign-in?redirectTo=%2Fsettings%2Fphone",
  status: 302,
};

/** Status + Location bila hasilnya redirect; `null` bila bukan Response. */
const redirectOf = (result: unknown) =>
  result instanceof Response
    ? { location: result.headers.get("location"), status: result.status }
    : null;

describe("route /settings/phone loader", () => {
  it("memuat Turnstile (CSP mengizinkan widget)", () => {
    expect(handle.turnstile).toBeTruthy();
  });

  it("tanpa nomor (field tidak dikirim) → null/false + site key", async () => {
    const { result } = await runLoader(() => jsonResponse(ME_FIXTURE));

    expect(result).toStrictEqual({
      phoneNumber: null,
      phoneNumberVerified: false,
      turnstileSiteKey: TEST_ENV.VITE_TURNSTILE_SITE_KEY,
    });
  });

  it("nomor terverifikasi diteruskan dari /api/me", async () => {
    const { api, result } = await runLoader(() =>
      meWith({ phoneNumber: E164, phoneNumberVerified: true })
    );

    expect(describeRequest(api.requests[0])).toStrictEqual({
      method: "GET",
      path: "/api/me",
    });
    expect(result).toMatchObject({
      phoneNumber: E164,
      phoneNumberVerified: true,
    });
  });

  it("tanpa sesi → redirect /sign-in dengan redirectTo halaman ini", async () => {
    const { result } = await runLoader(unauthorized);

    expect(redirectOf(result)).toStrictEqual(SIGN_IN_REDIRECT);
  });

  it("error api selain 401 → dilempar ke ErrorBoundary", async () => {
    const { result } = await runLoader(
      () => new Response(null, { status: 503 })
    );

    expect(result).toMatchObject({ init: { status: 503 } });
  });
});

describe("route /settings/phone action", () => {
  it("tanpa sesi → redirect /sign-in, OTP tidak dikirim", async () => {
    const { api, result } = await runAction(unauthorized);

    expect(redirectOf(result)).toStrictEqual(SIGN_IN_REDIRECT);
    expect(api.requests.map((request) => request.url.pathname)).toStrictEqual([
      "/api/me",
    ]);
  });

  it("verifikasi tanpa sesi juga redirect tanpa memanggil endpoint verify", async () => {
    const { api, result } = await runAction(unauthorized, {
      [INTENT_FIELD]: PHONE_INTENTS.verify,
      channel: "whatsapp",
      code: "123456",
      phoneNumber: E164,
    });

    expect(redirectOf(result)).toStrictEqual(SIGN_IN_REDIRECT);
    expect(api.requests).toHaveLength(1);
  });

  it("dengan sesi → cek sesi lalu kirim OTP", async () => {
    const { api, result } = await runAction((request) =>
      request.url.pathname === "/api/me"
        ? jsonResponse(ME_FIXTURE)
        : jsonResponse({ message: "code sent" })
    );

    expect(api.requests.map((request) => request.url.pathname)).toStrictEqual([
      "/api/me",
      "/api/auth/phone-number/send-otp",
    ]);
    expect(result).toMatchObject({ data: { step: "verify" } });
  });
});
