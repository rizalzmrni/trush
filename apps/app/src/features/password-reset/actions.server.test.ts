import { CAPTCHA_HEADER } from "@trush/auth/client";
import { describe, expect, it } from "vitest";

import {
  createFakeApi,
  createTestContext,
  describeRequest,
  formRequest,
  jsonResponse,
  pickHeaders,
} from "../../testing/cloudflare";
import type { ApiHandler } from "../../testing/cloudflare";
import { TURNSTILE_FIELD } from "../auth/form-schema";
import { forgotPasswordAction, resetPasswordAction } from "./actions.server";

// Semua nilai palsu; Service Binding API palsu, tanpa jaringan.
const EMAIL = "budi@example.test";
const CAPTCHA = "token-turnstile-palsu";
const TOKEN = "token-reset-palsu";
const NEW_PASSWORD = "kata-sandi-baru-palsu-1";
const IDENTICAL_BODY = {
  message:
    "If this email exists in our system, check your email for the reset link",
  status: true,
};

const authError = (status: number, code?: string, headers?: HeadersInit) =>
  jsonResponse(code ? { code, message: "pesan internal" } : {}, {
    headers,
    status,
  });

const runForgot = async (
  fields: Record<string, string>,
  handler: ApiHandler = () => jsonResponse(IDENTICAL_BODY)
) => {
  const api = createFakeApi(handler);
  const result = await forgotPasswordAction({
    context: createTestContext({ api }),
    request: formRequest("/forgot-password", fields),
  });
  return { api, result };
};

const runReset = async (
  fields: Record<string, string>,
  handler: ApiHandler = () => jsonResponse({ status: true })
) => {
  const api = createFakeApi(handler);
  const result = await resetPasswordAction({
    context: createTestContext({ api }),
    request: formRequest("/reset-password", fields),
  });
  return { api, result };
};

interface DataResult {
  readonly data: Record<string, unknown>;
  readonly init: { readonly status: number } | null;
}

const asData = (result: unknown): DataResult => {
  expect(result).not.toBeInstanceOf(Response);
  expect(result).toMatchObject({ type: "DataWithResponseInit" });
  return result as DataResult;
};

const FORGOT_FIELDS = { [TURNSTILE_FIELD]: CAPTCHA, email: EMAIL };
const RESET_FIELDS = { newPassword: NEW_PASSWORD, token: TOKEN };

describe(forgotPasswordAction, () => {
  it("POST email + redirectTo halaman reset app, token Turnstile di header", async () => {
    const { api } = await runForgot({
      ...FORGOT_FIELDS,
      email: " Budi@Example.TEST ",
    });

    const [request] = api.requests;
    expect(describeRequest(request)).toStrictEqual({
      method: "POST",
      path: "/api/auth/request-password-reset",
    });
    expect(pickHeaders(request?.headers, [CAPTCHA_HEADER])).toStrictEqual({
      [CAPTCHA_HEADER]: CAPTCHA,
    });
    expect(JSON.parse(request?.body ?? "null")).toStrictEqual({
      email: EMAIL,
      redirectTo: "https://app.example.test/reset-password",
    });
  });

  it("redirectTo dari form diabaikan (tujuan tautan selalu halaman reset app)", async () => {
    const { api } = await runForgot({
      ...FORGOT_FIELDS,
      redirectTo: "https://evil.example/reset-password",
    });

    expect(api.requests[0]?.body).not.toContain("evil.example");
  });

  it("sukses → status sent dengan email (tampilan sama untuk terdaftar/tidak)", async () => {
    const { result } = await runForgot(FORGOT_FIELDS);

    expect(result).toMatchObject({ data: { email: EMAIL, status: "sent" } });
  });

  it.each([
    ["tanpa Turnstile", { [TURNSTILE_FIELD]: "" }, "captchaToken"],
    ["email tidak valid", { email: "bukan-email" }, "email"],
  ])("%s → 400 tanpa memanggil api", async (_label, overrides, field) => {
    const { api, result } = await runForgot({ ...FORGOT_FIELDS, ...overrides });

    const { data, init } = asData(result);
    expect(init?.status).toBe(400);
    expect(data).toMatchObject({
      fieldErrors: { [field]: expect.any(String) },
      status: "error",
    });
    expect(api.requests).toHaveLength(0);
  });

  it("429 OTP_RATE_LIMITED → pesan dengan waktu tunggu, email diisi ulang", async () => {
    const { result } = await runForgot(FORGOT_FIELDS, () =>
      authError(429, "OTP_RATE_LIMITED", { "retry-after": "3600" })
    );

    const { data, init } = asData(result);
    expect(init?.status).toBe(429);
    expect(data).toMatchObject({
      formError: expect.stringMatching(
        /^Terlalu banyak permintaan reset kata sandi\. Coba lagi /u
      ),
      status: "error",
      values: { email: EMAIL },
    });
  });

  it("403 INVALID_REDIRECT_URL → pesan cadangan, tanpa kode mentah", async () => {
    const { result } = await runForgot(FORGOT_FIELDS, () =>
      authError(403, "INVALID_REDIRECT_URL")
    );

    expect(asData(result).data.formError).toBe(
      "Terjadi kesalahan. Coba lagi beberapa saat lagi."
    );
  });
});

describe(resetPasswordAction, () => {
  it("POST newPassword + token tanpa header captcha", async () => {
    const { api } = await runReset({ ...RESET_FIELDS, token: ` ${TOKEN} ` });

    const [request] = api.requests;
    expect(describeRequest(request)).toStrictEqual({
      method: "POST",
      path: "/api/auth/reset-password",
    });
    expect(JSON.parse(request?.body ?? "null")).toStrictEqual(RESET_FIELDS);
    expect(request?.headers.has(CAPTCHA_HEADER)).toBeFalsy();
  });

  it("sukses → /sign-in?notice=password-reset tanpa redirectTo", async () => {
    const { result } = await runReset({
      ...RESET_FIELDS,
      redirectTo: "/billing",
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("location")).toBe(
      "/sign-in?notice=password-reset"
    );
  });

  it("token kosong → invalid-token tanpa memanggil api", async () => {
    const { api, result } = await runReset({ ...RESET_FIELDS, token: "  " });

    const { data, init } = asData(result);
    expect(init?.status).toBe(400);
    expect(data).toStrictEqual({ status: "invalid-token" });
    expect(api.requests).toHaveLength(0);
  });

  it.each([
    ["terlalu pendek", "pendek"],
    ["terlalu panjang", "a".repeat(200)],
  ])(
    "kata sandi %s → 400 field newPassword tanpa memanggil api",
    async (_label, newPassword) => {
      const { api, result } = await runReset({ ...RESET_FIELDS, newPassword });

      expect(asData(result).data).toMatchObject({
        fieldErrors: {
          newPassword: expect.stringMatching(
            /^Kata sandi (?:minimal|maksimal)/u
          ),
        },
        status: "error",
      });
      expect(api.requests).toHaveLength(0);
    }
  );

  it("api 400 INVALID_TOKEN → invalid-token (minta tautan baru)", async () => {
    const { result } = await runReset(RESET_FIELDS, () =>
      authError(400, "INVALID_TOKEN")
    );

    const { data, init } = asData(result);
    expect(init?.status).toBe(400);
    expect(data).toStrictEqual({ status: "invalid-token" });
  });

  it("api PASSWORD_COMPROMISED → pesan di field newPassword", async () => {
    const { result } = await runReset(RESET_FIELDS, () =>
      authError(400, "PASSWORD_COMPROMISED")
    );

    expect(asData(result).data).toMatchObject({
      fieldErrors: { newPassword: expect.any(String) },
      status: "error",
    });
  });

  it("api error lain → formError", async () => {
    const { result } = await runReset(RESET_FIELDS, () => authError(500));

    expect(asData(result).data).toStrictEqual({
      formError: "Terjadi kesalahan. Coba lagi beberapa saat lagi.",
      status: "error",
    });
  });
});
