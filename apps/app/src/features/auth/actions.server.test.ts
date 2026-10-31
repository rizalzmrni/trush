// @vitest-environment node
// Action berjalan di Worker; happy-dom memfilter header terlarang browser
// (`cookie`, `origin`, `set-cookie`) sehingga tidak mewakili runtime.
import { CAPTCHA_HEADER } from "@trush/auth/client";
import { describe, expect, it } from "vitest";

import {
  createFakeApi,
  createTestContext,
  describeRequest,
  FORWARDED_FROM_APP_REQUEST,
  formRequest,
  jsonResponse,
  pickHeaders,
  SESSION_COOKIE,
} from "../../testing/cloudflare";
import type { ApiHandler } from "../../testing/cloudflare";
import { signInAction, signOutAction, signUpAction } from "./actions.server";
import { TURNSTILE_FIELD } from "./form-schema";

// Dirangkai agar lint `no-script-url` tidak membaca data uji sebagai tautan
// yang dieksekusi; nilainya tetap `javascript:alert(1)`.
const SCRIPT_URL = `${"javascript"}:alert(1)`;

const PASSWORD = "kata-sandi-palsu-1";
const CAPTCHA = "token-turnstile-palsu";
const NEW_SESSION_COOKIE =
  "better-auth.session_token=baru-palsu; Path=/; HttpOnly; Secure; SameSite=Lax";
const DATA_COOKIE = "better-auth.session_data=palsu; Path=/; HttpOnly; Secure";
const CLEAR_COOKIE =
  "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure";

const SIGN_IN_FIELDS = {
  email: "budi@example.test",
  password: PASSWORD,
  [TURNSTILE_FIELD]: CAPTCHA,
};
const SIGN_UP_FIELDS = { ...SIGN_IN_FIELDS, name: "Budi" };

const okWithCookies = (...cookies: string[]): Response => {
  const headers = new Headers();
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }
  return Response.json({ token: "x" }, { headers });
};

const authError = (status: number, code?: string) =>
  jsonResponse(code ? { code, message: "pesan internal" } : {}, { status });

const run = async (
  action: typeof signInAction,
  {
    cookie,
    fields,
    handler,
    path,
  }: {
    cookie?: string;
    fields: Record<string, string>;
    handler: ApiHandler;
    path: string;
  }
) => {
  const api = createFakeApi(handler);
  const result = await action({
    context: createTestContext({ api }),
    request: formRequest(path, fields, cookie),
  });
  return { api, result };
};

/** Hasil `data(...)` dari action gagal. */
interface FailureResult {
  readonly data: {
    readonly fieldErrors?: Record<string, string>;
    readonly formError?: string;
    readonly values: Record<string, unknown>;
  };
  readonly init: { readonly status: number } | null;
}

const asFailure = (result: unknown): FailureResult => {
  expect(result).not.toBeInstanceOf(Response);
  expect(result).toMatchObject({ type: "DataWithResponseInit" });
  return result as FailureResult;
};

const asRedirect = (result: unknown): Response => {
  expect(result).toBeInstanceOf(Response);
  const response = result as Response;
  expect(response.status).toBe(302);
  return response;
};

describe.each([
  {
    action: signInAction,
    endpoint: "/api/auth/sign-in/email",
    expectedBody: { email: "budi@example.test", password: PASSWORD },
    fields: SIGN_IN_FIELDS,
    name: "signInAction",
    path: "/sign-in",
  },
  {
    action: signUpAction,
    endpoint: "/api/auth/sign-up/email",
    expectedBody: {
      email: "budi@example.test",
      name: "Budi",
      password: PASSWORD,
    },
    fields: SIGN_UP_FIELDS,
    name: "signUpAction",
    path: "/sign-up",
  },
])("$name", ({ action, endpoint, expectedBody, fields, path }) => {
  it("POST ke endpoint better-auth lewat binding dengan token di header, bukan body", async () => {
    const { api } = await run(action, {
      cookie: SESSION_COOKIE,
      fields: { ...fields, email: "  budi@example.test  " },
      handler: () => okWithCookies(NEW_SESSION_COOKIE),
      path,
    });

    expect(api.requests).toHaveLength(1);
    const [request] = api.requests;
    expect(describeRequest(request)).toStrictEqual({
      method: "POST",
      path: endpoint,
    });
    expect(
      pickHeaders(request?.headers, [CAPTCHA_HEADER, "content-type"])
    ).toStrictEqual({
      [CAPTCHA_HEADER]: CAPTCHA,
      "content-type": "application/json",
    });
    expect(JSON.parse(request?.body ?? "null")).toStrictEqual(expectedBody);
    expect(request?.body).not.toContain(CAPTCHA);
  });

  it("meneruskan cookie, origin, IP, dan user-agent request asli", async () => {
    const { api } = await run(action, {
      cookie: SESSION_COOKIE,
      fields,
      handler: () => okWithCookies(NEW_SESSION_COOKIE),
      path,
    });

    expect(
      pickHeaders(api.requests[0]?.headers, [
        "cookie",
        "origin",
        "cf-connecting-ip",
        "user-agent",
      ])
    ).toStrictEqual({ ...FORWARDED_FROM_APP_REQUEST, cookie: SESSION_COOKIE });
  });

  it("sukses → redirect ke redirectTo internal dan meneruskan semua Set-Cookie", async () => {
    const { result } = await run(action, {
      fields: { ...fields, redirectTo: "/org/acme?tab=members" },
      handler: () => okWithCookies(NEW_SESSION_COOKIE, DATA_COOKIE),
      path,
    });

    const response = asRedirect(result);
    expect(response.headers.get("location")).toBe("/org/acme?tab=members");
    expect(response.headers.getSetCookie()).toStrictEqual([
      NEW_SESSION_COOKIE,
      DATA_COOKIE,
    ]);
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example",
    "/\\evil.example",
    SCRIPT_URL,
    "/sign-in",
    "",
  ])("redirectTo %j disaring → /", async (redirectTo) => {
    const { result } = await run(action, {
      fields: { ...fields, redirectTo },
      handler: () => okWithCookies(NEW_SESSION_COOKIE),
      path,
    });

    expect(asRedirect(result).headers.get("location")).toBe("/");
  });

  it.each(["/.//evil.example", "/a/..//evil.example", "/%2e//evil.example"])(
    "redirectTo dot-segment %j disaring → /",
    async (redirectTo) => {
      const { result } = await run(action, {
        fields: { ...fields, redirectTo },
        handler: () => okWithCookies(NEW_SESSION_COOKIE),
        path,
      });

      expect(asRedirect(result).headers.get("location")).toBe("/");
    }
  );

  it("validasi gagal → 400 dengan fieldErrors, tanpa memanggil api", async () => {
    const { api, result } = await run(action, {
      fields: { email: "bukan-email", name: "Budi", password: PASSWORD },
      handler: () => okWithCookies(NEW_SESSION_COOKIE),
      path,
    });

    expect(api.requests).toHaveLength(0);
    const failure = asFailure(result);
    expect(failure.init?.status).toBe(400);
    expect(failure.data.fieldErrors).toMatchObject({
      captchaToken: "Selesaikan verifikasi keamanan terlebih dahulu.",
      email: "Masukkan alamat email yang valid.",
    });
    expect(failure.data.values.email).toBe("bukan-email");
  });

  it("nilai isi ulang tidak memuat kata sandi atau token", async () => {
    const { result } = await run(action, {
      fields,
      handler: () => authError(401, "INVALID_EMAIL_OR_PASSWORD"),
      path,
    });

    const serialized = JSON.stringify(asFailure(result).data);
    expect(serialized).not.toContain(PASSWORD);
    expect(serialized).not.toContain(CAPTCHA);
  });

  it.each([
    [401, "INVALID_EMAIL_OR_PASSWORD", "Email atau kata sandi salah."],
    [
      400,
      "MISSING_RESPONSE",
      "Selesaikan verifikasi keamanan terlebih dahulu.",
    ],
    [403, "VERIFICATION_FAILED", "Verifikasi keamanan gagal. Coba lagi."],
    [
      422,
      "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
      "Email ini sudah terdaftar. Silakan masuk.",
    ],
    [
      400,
      "PASSWORD_COMPROMISED",
      "Kata sandi ini pernah bocor di layanan lain. Pilih kata sandi yang berbeda.",
    ],
    [
      503,
      "SERVICE_UNAVAILABLE",
      "Layanan verifikasi keamanan sedang bermasalah. Coba lagi sebentar.",
    ],
    [
      429,
      undefined,
      "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
    ],
    [
      400,
      "KODE_TIDAK_DIKENAL",
      "Terjadi kesalahan. Coba lagi beberapa saat lagi.",
    ],
    [500, undefined, "Terjadi kesalahan. Coba lagi beberapa saat lagi."],
  ])(
    "error api %i %s → pesan form dan status diteruskan",
    async (status, code, message) => {
      const { result } = await run(action, {
        fields,
        handler: () => authError(status, code),
        path,
      });

      const failure = asFailure(result);
      expect(failure.init?.status).toBe(status);
      expect(failure.data.formError).toBe(message);
      expect(failure.data.formError).not.toContain("pesan internal");
      expect(failure.data.values.email).toBe("budi@example.test");
    }
  );

  it("body error bukan JSON → pesan cadangan", async () => {
    const { result } = await run(action, {
      fields,
      handler: () => new Response("<html>Bad Gateway</html>", { status: 502 }),
      path,
    });

    expect(asFailure(result).data.formError).toBe(
      "Terjadi kesalahan. Coba lagi beberapa saat lagi."
    );
  });

  it("error jaringan Service Binding dilempar ke ErrorBoundary", async () => {
    const networkError = new TypeError("Network connection lost.");

    await expect(
      run(action, {
        fields,
        handler: () => {
          throw networkError;
        },
        path,
      })
    ).rejects.toBe(networkError);
  });
});

describe("signInAction 2FA", () => {
  it("twoFactorRedirect → pesan form, tidak redirect", async () => {
    const { result } = await run(signInAction, {
      fields: SIGN_IN_FIELDS,
      handler: () => jsonResponse({ twoFactorRedirect: true }),
      path: "/sign-in",
    });

    const failure = asFailure(result);
    expect(failure.init?.status).toBe(400);
    expect(failure.data.formError).toContain("verifikasi dua langkah");
  });
});

describe(signOutAction, () => {
  it("POST /api/auth/sign-out dengan cookie sesi, tanpa header captcha", async () => {
    const { api } = await run(signOutAction, {
      cookie: SESSION_COOKIE,
      fields: {},
      handler: () => okWithCookies(CLEAR_COOKIE),
      path: "/sign-out",
    });

    expect(api.requests).toHaveLength(1);
    const [request] = api.requests;
    expect(describeRequest(request)).toStrictEqual({
      method: "POST",
      path: "/api/auth/sign-out",
    });
    expect(
      pickHeaders(request?.headers, ["cookie", "origin", CAPTCHA_HEADER])
    ).toStrictEqual({
      cookie: SESSION_COOKIE,
      origin: FORWARDED_FROM_APP_REQUEST.origin,
      [CAPTCHA_HEADER]: null,
    });
  });

  it("sukses → redirect /sign-in dan meneruskan cookie penghapus sesi", async () => {
    const { result } = await run(signOutAction, {
      cookie: SESSION_COOKIE,
      fields: {},
      handler: () => okWithCookies(CLEAR_COOKIE),
      path: "/sign-out",
    });

    const response = asRedirect(result);
    expect(response.headers.get("location")).toBe("/sign-in");
    expect(response.headers.getSetCookie()).toStrictEqual([CLEAR_COOKIE]);
  });

  it("redirectTo kiriman form diabaikan", async () => {
    const { result } = await run(signOutAction, {
      cookie: SESSION_COOKIE,
      fields: { redirectTo: "https://evil.example" },
      handler: () => okWithCookies(CLEAR_COOKIE),
      path: "/sign-out",
    });

    expect(asRedirect(result).headers.get("location")).toBe("/sign-in");
  });

  it.each([400, 401])("4xx %i tetap diarahkan ke /sign-in", async (status) => {
    const { result } = await run(signOutAction, {
      fields: {},
      handler: () => authError(status),
      path: "/sign-out",
    });

    expect(asRedirect(result).headers.get("location")).toBe("/sign-in");
  });

  it.each([500, 503])("5xx %i dilempar ke ErrorBoundary", async (status) => {
    const error = await run(signOutAction, {
      cookie: SESSION_COOKIE,
      fields: {},
      handler: () => authError(status),
      path: "/sign-out",
    }).then(
      () => {
        throw new Error("Diharapkan melempar.");
      },
      (thrownError: unknown) => thrownError
    );

    expect(error).not.toBeInstanceOf(Response);
    expect(error).toMatchObject({
      init: { status },
      type: "DataWithResponseInit",
    });
  });
});
