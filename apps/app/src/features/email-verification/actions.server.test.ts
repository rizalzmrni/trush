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
import { verifyEmailAction } from "./actions.server";
import { INTENT_FIELD, VERIFY_EMAIL_INTENTS } from "./form-schema";

// Semua nilai palsu; Service Binding API palsu, tanpa jaringan.
const EMAIL = "budi@example.test";
const CAPTCHA = "token-turnstile-palsu";
const OTP = "482913";
const SEND_ENDPOINT = "/api/auth/email-otp/send-verification-otp";
const VERIFY_ENDPOINT = "/api/auth/email-otp/verify-email";

const ok = () => jsonResponse({ success: true });
const authError = (status: number, code?: string, headers?: HeadersInit) =>
  jsonResponse(code ? { code, message: "pesan internal" } : {}, {
    headers,
    status,
  });

const run = async (
  fields: Record<string, string>,
  handler: ApiHandler = ok
) => {
  const api = createFakeApi(handler);
  const result = await verifyEmailAction({
    context: createTestContext({ api }),
    request: formRequest("/verify-email", fields),
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

const asRedirect = (result: unknown): URL => {
  expect(result).toBeInstanceOf(Response);
  const response = result as Response;
  expect(response.status).toBe(302);
  return new URL(response.headers.get("location") ?? "", "https://app.test");
};

const sendFields = (
  intent: string,
  overrides: Record<string, string> = {}
) => ({
  [INTENT_FIELD]: intent,
  [TURNSTILE_FIELD]: CAPTCHA,
  email: EMAIL,
  ...overrides,
});

const verifyFields = (overrides: Record<string, string> = {}) => ({
  [INTENT_FIELD]: VERIFY_EMAIL_INTENTS.verify,
  email: EMAIL,
  otp: OTP,
  ...overrides,
});

describe("verifyEmailAction: intent", () => {
  it.each([undefined, "", "hapus-akun"])(
    "intent %j tidak dikenal → 400 tanpa memanggil api",
    async (intent) => {
      const fields: Record<string, string> = { email: EMAIL, otp: OTP };
      if (intent !== undefined) {
        fields[INTENT_FIELD] = intent;
      }

      const { api, result } = await run(fields);

      const { data, init } = asData(result);
      expect(init?.status).toBe(400);
      expect(data).toMatchObject({
        formError: expect.any(String),
        step: "request",
      });
      expect(api.requests).toHaveLength(0);
    }
  );
});

describe.each([
  ["kirim kode", VERIFY_EMAIL_INTENTS.send, "request"],
  ["kirim ulang", VERIFY_EMAIL_INTENTS.resend, "verify"],
] as const)("verifyEmailAction: %s", (_label, intent, failStep) => {
  it("POST email + type ke api dengan token Turnstile di header", async () => {
    const { api } = await run(
      sendFields(intent, { email: "  Budi@Example.TEST " })
    );

    const [request] = api.requests;
    expect(describeRequest(request)).toStrictEqual({
      method: "POST",
      path: SEND_ENDPOINT,
    });
    expect(pickHeaders(request?.headers, [CAPTCHA_HEADER])).toStrictEqual({
      [CAPTCHA_HEADER]: CAPTCHA,
    });
    expect(JSON.parse(request?.body ?? "null")).toStrictEqual({
      email: EMAIL,
      type: "email-verification",
    });
    expect(request?.body).not.toContain(CAPTCHA);
  });

  it("sukses → langkah kode dengan pesan netral (tidak membedakan alamat)", async () => {
    const { result } = await run(sendFields(intent));

    expect(result).toMatchObject({
      data: {
        email: EMAIL,
        notice: expect.stringContaining(EMAIL),
        step: "verify",
      },
    });
    expect(JSON.stringify(result)).toContain("Bila");
  });

  it("tanpa token Turnstile → 400 tanpa memanggil api", async () => {
    const { api, result } = await run(
      sendFields(intent, { [TURNSTILE_FIELD]: "" })
    );

    const { data, init } = asData(result);
    expect(init?.status).toBe(400);
    expect(data).toMatchObject({ step: failStep });
    expect(api.requests).toHaveLength(0);
  });

  it("email tidak valid → 400 field email di langkah isi email", async () => {
    const { api, result } = await run(
      sendFields(intent, { email: "bukan-email" })
    );

    const { data, init } = asData(result);
    expect(init?.status).toBe(400);
    expect(data).toMatchObject({
      fieldErrors: { email: expect.any(String) },
      step: "request",
      values: { email: "bukan-email" },
    });
    expect(api.requests).toHaveLength(0);
  });

  it("429 OTP_RATE_LIMITED → pesan dengan waktu tunggu dari Retry-After", async () => {
    const { result } = await run(sendFields(intent), () =>
      authError(429, "OTP_RATE_LIMITED", { "retry-after": "720" })
    );

    const { data, init } = asData(result);
    expect(init?.status).toBe(429);
    expect(data).toMatchObject({
      formError: expect.stringMatching(
        /^Terlalu banyak permintaan kode\. Coba lagi .*12 menit/u
      ),
      step: failStep,
    });
  });

  it("400 INVALID_OTP_TYPE (kode tak dikenal UI) → pesan cadangan tanpa kode mentah", async () => {
    const { result } = await run(sendFields(intent), () =>
      authError(400, "INVALID_OTP_TYPE")
    );

    const { data } = asData(result);
    expect(data.formError).toBe(
      "Terjadi kesalahan. Coba lagi beberapa saat lagi."
    );
  });
});

describe("verifyEmailAction: verifikasi kode", () => {
  it("POST email + otp tanpa header captcha", async () => {
    const { api } = await run(verifyFields({ otp: " 482913 " }));

    const [request] = api.requests;
    expect(describeRequest(request)).toStrictEqual({
      method: "POST",
      path: VERIFY_ENDPOINT,
    });
    expect(JSON.parse(request?.body ?? "null")).toStrictEqual({
      email: EMAIL,
      otp: OTP,
    });
    expect(request?.headers.has(CAPTCHA_HEADER)).toBeFalsy();
  });

  it("sukses → /sign-in dengan notice, email, dan redirectTo tersaring", async () => {
    const { result } = await run(verifyFields({ redirectTo: "/org/acme" }));

    const location = asRedirect(result);
    expect(location.pathname).toBe("/sign-in");
    expect(Object.fromEntries(location.searchParams)).toStrictEqual({
      email: EMAIL,
      notice: "email-verified",
      redirectTo: "/org/acme",
    });
  });

  it.each(["https://evil.example", "//evil.example", "/verify-email"])(
    "redirectTo %j disaring (tidak ikut ke /sign-in)",
    async (redirectTo) => {
      const { result } = await run(verifyFields({ redirectTo }));

      expect(asRedirect(result).searchParams.has("redirectTo")).toBeFalsy();
    }
  );

  it.each(["12345", "1234567", "abcdef", ""])(
    "kode %j tidak 6 digit → 400 field otp, tanpa memanggil api",
    async (otp) => {
      const { api, result } = await run(verifyFields({ otp }));

      const { data, init } = asData(result);
      expect(init?.status).toBe(400);
      expect(data).toMatchObject({
        email: EMAIL,
        fieldErrors: { otp: "Masukkan 6 digit kode dari email." },
        step: "verify",
      });
      expect(api.requests).toHaveLength(0);
    }
  );

  it("email hilang/tidak valid → kembali ke langkah isi email", async () => {
    const { api, result } = await run(verifyFields({ email: "x" }));

    expect(asData(result).data).toMatchObject({
      fieldErrors: { email: expect.any(String) },
      step: "request",
    });
    expect(api.requests).toHaveLength(0);
  });

  it.each([
    [400, "INVALID_OTP", "Kode salah. Periksa lagi lalu coba kembali."],
    [400, "OTP_EXPIRED", "Kode sudah kedaluwarsa. Minta kode baru di bawah."],
    [
      403,
      "TOO_MANY_ATTEMPTS",
      "Terlalu banyak kode salah. Minta kode baru di bawah.",
    ],
  ] as const)(
    "api %i %s → pesan Indonesia di langkah kode",
    async (status, code, message) => {
      const { result } = await run(verifyFields(), () =>
        authError(status, code)
      );

      const { data, init } = asData(result);
      expect(init?.status).toBe(status);
      expect(data).toStrictEqual({
        email: EMAIL,
        formError: message,
        step: "verify",
      });
    }
  );

  it("429 rate limit IP → pesan percobaan dengan X-Retry-After", async () => {
    const { result } = await run(verifyFields(), () =>
      authError(429, undefined, { "x-retry-after": "30" })
    );

    expect(asData(result).data.formError).toMatch(
      /^Terlalu banyak percobaan kode\. Coba lagi /u
    );
  });

  it("error jaringan Service Binding dilempar ke ErrorBoundary", async () => {
    await expect(
      run(verifyFields(), () => {
        throw new TypeError("Network connection lost.");
      })
    ).rejects.toThrow(TypeError);
  });
});
