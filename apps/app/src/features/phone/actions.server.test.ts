import { CAPTCHA_HEADER, OTP_CHANNEL_HEADER } from "@trush/auth/client";
import { describe, expect, it } from "vitest";

import {
  createFakeApi,
  createTestContext,
  describeRequest,
  formRequest,
  jsonResponse,
  pickHeaders,
  SESSION_COOKIE,
} from "../../testing/cloudflare";
import type { ApiHandler } from "../../testing/cloudflare";
import { TURNSTILE_FIELD } from "../auth/form-schema";
import { phoneAction } from "./actions.server";
import { INTENT_FIELD, PHONE_INTENTS } from "./form-schema";
import type { PhoneActionResult } from "./form-schema";

const PATH = "/settings/phone";
const CAPTCHA = "token-turnstile-palsu";
const LOCAL = "0812-3456-7890";
const E164 = "+6281234567890";
const SEND_ENDPOINT = "/api/auth/phone-number/send-otp";
const VERIFY_ENDPOINT = "/api/auth/phone-number/verify";
const SESSION_SET_COOKIE =
  "better-auth.session_data=baru-palsu; Path=/; HttpOnly; Secure; SameSite=Lax";
const OTHER_SET_COOKIE =
  "better-auth.dont_remember=palsu; Path=/; HttpOnly; Secure";
const FALLBACK = "Terjadi kesalahan. Coba lagi beberapa saat lagi.";

const SEND_FIELDS = {
  [INTENT_FIELD]: PHONE_INTENTS.send,
  [TURNSTILE_FIELD]: CAPTCHA,
  channel: "whatsapp",
  phoneNumber: LOCAL,
};
const RESEND_FIELDS = {
  ...SEND_FIELDS,
  [INTENT_FIELD]: PHONE_INTENTS.resend,
  channel: "sms",
  phoneNumber: E164,
};
const VERIFY_FIELDS = {
  [INTENT_FIELD]: PHONE_INTENTS.verify,
  channel: "whatsapp",
  code: "123456",
  phoneNumber: E164,
};

/** Hasil `data(...)` dari action. */
interface ActionData {
  readonly data: PhoneActionResult & Record<string, unknown>;
  readonly init: ResponseInit | null | undefined;
}

const run = async (
  fields: Record<string, string>,
  handler: ApiHandler = () => jsonResponse({ status: true })
) => {
  const api = createFakeApi(handler);
  const result = await phoneAction({
    context: createTestContext({ api }),
    request: formRequest(PATH, fields, SESSION_COOKIE),
  });
  expect(result).toMatchObject({ type: "DataWithResponseInit" });
  return { api, result: result as unknown as ActionData };
};

const statusOf = ({ init }: ActionData): number => init?.status ?? 200;

const authError = (status: number, code?: string, headers?: HeadersInit) =>
  jsonResponse(code ? { code, message: "pesan internal" } : {}, {
    headers,
    status,
  });

describe("phoneAction: kirim kode (send-otp)", () => {
  it("POST send-otp lewat binding: nomor di body, kanal & captcha di header", async () => {
    const { api } = await run({ ...SEND_FIELDS, phoneNumber: `  ${LOCAL}  ` });

    expect(api.requests).toHaveLength(1);
    const [request] = api.requests;
    expect(describeRequest(request)).toStrictEqual({
      method: "POST",
      path: SEND_ENDPOINT,
    });
    expect(
      pickHeaders(request?.headers, [
        CAPTCHA_HEADER,
        OTP_CHANNEL_HEADER,
        "content-type",
        "cookie",
      ])
    ).toStrictEqual({
      [CAPTCHA_HEADER]: CAPTCHA,
      [OTP_CHANNEL_HEADER]: "whatsapp",
      "content-type": "application/json",
      cookie: SESSION_COOKIE,
    });
    expect(JSON.parse(request?.body ?? "null")).toStrictEqual({
      phoneNumber: LOCAL,
    });
    expect(request?.body).not.toContain(CAPTCHA);
  });

  it("sukses → langkah verify dengan notice kanal & nomor", async () => {
    const { result } = await run(SEND_FIELDS);

    expect(statusOf(result)).toBe(200);
    expect(result.data).toStrictEqual({
      channel: "whatsapp",
      notice: `Kode dikirim lewat WhatsApp ke ${LOCAL}.`,
      phoneNumber: LOCAL,
      step: "verify",
    });
  });

  it("kanal sms diteruskan ke header dan notice", async () => {
    const { api, result } = await run({ ...SEND_FIELDS, channel: "sms" });

    expect(api.requests[0]?.headers.get(OTP_CHANNEL_HEADER)).toBe("sms");
    expect(result.data).toMatchObject({
      channel: "sms",
      notice: `Kode dikirim lewat SMS ke ${LOCAL}.`,
    });
  });

  it.each([
    [
      "nomor sampah",
      { phoneNumber: "bukan-nomor" },
      "phoneNumber",
      "Masukkan nomor telepon yang valid, mis. 0812-3456-7890.",
    ],
    [
      "nomor kosong",
      { phoneNumber: "" },
      "phoneNumber",
      "Masukkan nomor telepon yang valid, mis. 0812-3456-7890.",
    ],
    [
      "tanpa token Turnstile",
      { [TURNSTILE_FIELD]: "" },
      "captchaToken",
      "Selesaikan verifikasi keamanan terlebih dahulu.",
    ],
    [
      "kanal tak dikenal",
      { channel: "telegram" },
      "channel",
      "Pilih cara pengiriman kode.",
    ],
  ])(
    "%s → 400 langkah send dengan error field, tanpa memanggil api",
    async (_label, override, field, message) => {
      const { api, result } = await run({ ...SEND_FIELDS, ...override });

      expect(api.requests).toHaveLength(0);
      expect(statusOf(result)).toBe(400);
      expect(result.data.step).toBe("send");
      expect(result.data.fieldErrors).toMatchObject({ [field]: message });
    }
  );

  it("gagal validasi mengisi ulang nomor & kanal yang diketik", async () => {
    const { result } = await run({
      ...SEND_FIELDS,
      [TURNSTILE_FIELD]: "",
      channel: "sms",
    });

    expect(result.data).toMatchObject({
      step: "send",
      values: { channel: "sms", phoneNumber: LOCAL },
    });
  });

  it.each([
    [
      400,
      "INVALID_PHONE_NUMBER",
      "Nomor telepon tidak valid atau negaranya belum didukung.",
    ],
    [400, "PHONE_NUMBER_EXIST", "Nomor ini sudah dipakai akun lain."],
    [
      400,
      "NOT_ALLOWLISTED",
      "Nomor ini tidak dapat dipakai di lingkungan ini.",
    ],
    [400, "VERIFICATION_FAILED", "Verifikasi keamanan gagal. Coba lagi."],
    [
      422,
      "RECIPIENT_UNREACHABLE",
      "Kode tidak dapat dikirim ke nomor ini lewat cara yang dipilih. Coba cara lain.",
    ],
    [
      502,
      "OTP_DELIVERY_FAILED",
      "Kode gagal dikirim. Coba lagi beberapa saat lagi.",
    ],
    [400, "KODE_TAK_DIKENAL", FALLBACK],
    [500, undefined, FALLBACK],
  ])(
    "api %i %s → status sama, pesan Indonesia di langkah send",
    async (status, code, message) => {
      const { result } = await run(SEND_FIELDS, () => authError(status, code));

      expect(statusOf(result)).toBe(status);
      expect(result.data).toStrictEqual({
        formError: message,
        step: "send",
        values: { channel: "whatsapp", phoneNumber: LOCAL },
      });
    }
  );

  it("body error bukan JSON → pesan fallback tanpa detail internal", async () => {
    const { result } = await run(
      SEND_FIELDS,
      () => new Response("<html>stack trace</html>", { status: 502 })
    );

    expect(result.data).toMatchObject({ formError: FALLBACK });
    expect(JSON.stringify(result.data)).not.toContain("stack");
  });

  it("pesan internal api tidak pernah diteruskan ke pengguna", async () => {
    const { result } = await run(SEND_FIELDS, () =>
      authError(400, "INVALID_PHONE_NUMBER")
    );

    expect(JSON.stringify(result.data)).not.toContain("pesan internal");
  });

  it("429 kuota OTP dengan Retry-After → menyebut waktu tunggu", async () => {
    const { result } = await run(SEND_FIELDS, () =>
      authError(429, "OTP_RATE_LIMITED", { "retry-after": "720" })
    );

    expect(statusOf(result)).toBe(429);
    expect(result.data).toMatchObject({
      formError: "Terlalu banyak permintaan kode. Coba lagi dalam 12 menit.",
      step: "send",
    });
  });

  it("429 rate limit IP better-auth dengan X-Retry-After → menyebut waktu tunggu", async () => {
    const { result } = await run(SEND_FIELDS, () =>
      authError(429, undefined, { "x-retry-after": "45" })
    );

    expect(statusOf(result)).toBe(429);
    expect(result.data).toMatchObject({
      formError: "Terlalu banyak permintaan kode. Coba lagi dalam 45 detik.",
    });
  });

  it("429 tanpa header tunggu → pesan umum", async () => {
    const { result } = await run(SEND_FIELDS, () => authError(429));

    expect(result.data).toMatchObject({
      formError:
        "Terlalu banyak permintaan kode. Tunggu sebentar lalu coba lagi.",
    });
  });
});

describe("phoneAction: kirim ulang (resend-otp)", () => {
  it("kirim ulang lewat SMS → header sms, tetap di langkah verify dengan notice", async () => {
    const { api, result } = await run(RESEND_FIELDS);

    expect(describeRequest(api.requests[0])).toStrictEqual({
      method: "POST",
      path: SEND_ENDPOINT,
    });
    expect(api.requests[0]?.headers.get(OTP_CHANNEL_HEADER)).toBe("sms");
    expect(api.requests[0]?.headers.get(CAPTCHA_HEADER)).toBe(CAPTCHA);
    expect(result.data).toStrictEqual({
      channel: "sms",
      notice: `Kode dikirim lewat SMS ke ${E164}.`,
      phoneNumber: E164,
      step: "verify",
    });
  });

  it("gagal kirim ulang → tetap di langkah verify dengan formError", async () => {
    const { result } = await run(RESEND_FIELDS, () =>
      authError(502, "OTP_DELIVERY_FAILED")
    );

    expect(statusOf(result)).toBe(502);
    expect(result.data).toStrictEqual({
      channel: "sms",
      formError: "Kode gagal dikirim. Coba lagi beberapa saat lagi.",
      phoneNumber: E164,
      step: "verify",
    });
  });

  it("kirim ulang tanpa token Turnstile → 400 verify dengan pesan captcha, tanpa api", async () => {
    const { api, result } = await run({
      ...RESEND_FIELDS,
      [TURNSTILE_FIELD]: "",
    });

    expect(api.requests).toHaveLength(0);
    expect(statusOf(result)).toBe(400);
    expect(result.data).toMatchObject({
      formError: "Selesaikan verifikasi keamanan terlebih dahulu.",
      phoneNumber: E164,
      step: "verify",
    });
  });

  it("kirim ulang tanpa nomor → kembali ke langkah send", async () => {
    const { api, result } = await run({ ...RESEND_FIELDS, phoneNumber: "" });

    expect(api.requests).toHaveLength(0);
    expect(result.data.step).toBe("send");
    expect(result.data.fieldErrors).toHaveProperty("phoneNumber");
  });

  it("429 kirim ulang dengan Retry-After → verify dengan waktu tunggu", async () => {
    const { result } = await run(RESEND_FIELDS, () =>
      authError(429, "OTP_RATE_LIMITED", { "retry-after": "3600" })
    );

    expect(statusOf(result)).toBe(429);
    expect(result.data).toMatchObject({
      formError: "Terlalu banyak permintaan kode. Coba lagi dalam 1 jam.",
      step: "verify",
    });
  });
});

describe("phoneAction: verifikasi (verify-otp)", () => {
  it("POST verify dengan updatePhoneNumber: true, tanpa captcha", async () => {
    const { api } = await run({ ...VERIFY_FIELDS, code: " 123456 " });

    expect(api.requests).toHaveLength(1);
    const [request] = api.requests;
    expect(describeRequest(request)).toStrictEqual({
      method: "POST",
      path: VERIFY_ENDPOINT,
    });
    expect(JSON.parse(request?.body ?? "null")).toStrictEqual({
      code: "123456",
      phoneNumber: E164,
      updatePhoneNumber: true,
    });
    expect(request?.headers.get("cookie")).toBe(SESSION_COOKIE);
  });

  it("sukses → step done dan semua Set-Cookie api diteruskan", async () => {
    const { result } = await run(VERIFY_FIELDS, () => {
      const headers = new Headers();
      headers.append("set-cookie", SESSION_SET_COOKIE);
      headers.append("set-cookie", OTHER_SET_COOKIE);
      return Response.json({ status: true }, { headers });
    });

    expect(result.data).toStrictEqual({ step: "done" });
    const headers = new Headers(result.init?.headers);
    expect(headers.getSetCookie()).toStrictEqual([
      SESSION_SET_COOKIE,
      OTHER_SET_COOKIE,
    ]);
    expect(statusOf(result)).toBe(200);
  });

  it.each([
    ["5 digit", "12345"],
    ["berisi huruf", "12a456"],
    ["kosong", ""],
  ])(
    "kode %s → 400 langkah verify dengan error kode, tanpa api",
    async (_label, code) => {
      const { api, result } = await run({ ...VERIFY_FIELDS, code });

      expect(api.requests).toHaveLength(0);
      expect(statusOf(result)).toBe(400);
      expect(result.data).toStrictEqual({
        channel: "whatsapp",
        fieldErrors: { code: "Masukkan 6 digit kode yang kamu terima." },
        phoneNumber: E164,
        step: "verify",
      });
    }
  );

  it("nomor hilang/rusak → kembali ke langkah send dengan error nomor", async () => {
    const { api, result } = await run({
      ...VERIFY_FIELDS,
      channel: "sms",
      phoneNumber: "xx",
    });

    expect(api.requests).toHaveLength(0);
    expect(statusOf(result)).toBe(400);
    expect(result.data).toStrictEqual({
      fieldErrors: {
        phoneNumber: "Masukkan nomor telepon yang valid, mis. 0812-3456-7890.",
      },
      step: "send",
      values: { channel: "sms", phoneNumber: "xx" },
    });
  });

  it.each([
    [400, "INVALID_OTP", "Kode salah. Periksa lagi lalu coba kembali."],
    [400, "OTP_EXPIRED", "Kode sudah kedaluwarsa. Minta kode baru."],
    [403, "TOO_MANY_ATTEMPTS", "Terlalu banyak kode salah. Minta kode baru."],
    [400, "PHONE_NUMBER_EXIST", "Nomor ini sudah dipakai akun lain."],
    [
      401,
      "USER_NOT_FOUND",
      "Sesi kamu sudah berakhir. Muat ulang halaman lalu masuk lagi.",
    ],
    [500, undefined, FALLBACK],
  ])(
    "api %i %s → tetap di langkah verify dengan pesan Indonesia",
    async (status, code, message) => {
      const { result } = await run(VERIFY_FIELDS, () =>
        authError(status, code)
      );

      expect(statusOf(result)).toBe(status);
      expect(result.data).toStrictEqual({
        channel: "whatsapp",
        formError: message,
        phoneNumber: E164,
        step: "verify",
      });
    }
  );

  it("gagal verifikasi tidak meneruskan Set-Cookie", async () => {
    const { result } = await run(VERIFY_FIELDS, () =>
      authError(400, "INVALID_OTP", { "set-cookie": SESSION_SET_COOKIE })
    );

    expect(new Headers(result.init?.headers).getSetCookie()).toStrictEqual([]);
  });

  it.each([
    [
      "X-Retry-After",
      { "x-retry-after": "30" },
      "Terlalu banyak percobaan kode. Coba lagi dalam 30 detik.",
    ],
    [
      "Retry-After",
      { "retry-after": "120" },
      "Terlalu banyak percobaan kode. Coba lagi dalam 2 menit.",
    ],
    [
      "tanpa header tunggu",
      {},
      "Terlalu banyak percobaan kode. Tunggu sebentar lalu coba lagi.",
    ],
    [
      "header tunggu tidak valid",
      { "retry-after": "besok" },
      "Terlalu banyak percobaan kode. Tunggu sebentar lalu coba lagi.",
    ],
  ])(
    "429 verifikasi (%s) → langkah verify, pesan percobaan kode",
    async (_label, headers, message) => {
      const { result } = await run(VERIFY_FIELDS, () =>
        authError(429, undefined, headers)
      );

      expect(statusOf(result)).toBe(429);
      expect(result.data).toStrictEqual({
        channel: "whatsapp",
        formError: message,
        phoneNumber: E164,
        step: "verify",
      });
    }
  );

  it("429 kirim ulang dari langkah verify tetap berbunyi permintaan kode", async () => {
    const { result } = await run(RESEND_FIELDS, () =>
      authError(429, undefined, { "x-retry-after": "30" })
    );

    expect(result.data).toMatchObject({
      formError: "Terlalu banyak permintaan kode. Coba lagi dalam 30 detik.",
      step: "verify",
    });
    expect(result.data.formError).not.toContain("percobaan");
  });
});

describe("phoneAction: intent", () => {
  it.each([
    ["tak dikenal", { [INTENT_FIELD]: "hapus-nomor" }],
    ["kosong", { [INTENT_FIELD]: "" }],
    ["hilang", {}],
  ])("intent %s → 400 langkah send, tanpa api", async (_label, fields) => {
    const { api, result } = await run({ phoneNumber: E164, ...fields });

    expect(api.requests).toHaveLength(0);
    expect(statusOf(result)).toBe(400);
    expect(result.data).toStrictEqual({
      formError: "Permintaan tidak dikenal. Muat ulang halaman.",
      step: "send",
      values: {},
    });
  });
});
