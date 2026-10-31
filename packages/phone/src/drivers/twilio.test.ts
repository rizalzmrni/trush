import { describe, expect, it, vi } from "vitest";

import { PhoneError } from "../errors";
import { createPhoneSender } from "../sender";
import type { PhoneEnv } from "../sender";

// Kredensial palsu; fetch selalu di-mock, Twilio live tidak pernah dipanggil.
const E164_ID = "+6281234567890";
const CODE = "482913";

const TWILIO_ENV: PhoneEnv = {
  APP_ENV: "production",
  PHONE_ALLOWED_COUNTRIES: ["ID"],
  PHONE_ALLOWLIST: undefined,
  PHONE_DRIVER: "twilio",
  TWILIO_ACCOUNT_SID: "ACtest",
  TWILIO_API_KEY_SECRET: "fake-secret",
  TWILIO_API_KEY_SID: "SKtest",
  TWILIO_MESSAGING_SERVICE_SID: "MGtest",
  TWILIO_TEST_ACCOUNT_SID: undefined,
  TWILIO_TEST_AUTH_TOKEN: undefined,
  TWILIO_WHATSAPP_OTP_CONTENT_SID: "HXtest",
};

const TWILIO_TEST_ENV: PhoneEnv = {
  ...TWILIO_ENV,
  APP_ENV: "development",
  PHONE_DRIVER: "twilio-test",
  TWILIO_TEST_ACCOUNT_SID: "ACsandbox",
  TWILIO_TEST_AUTH_TOKEN: "fake-token",
};

const created = () =>
  Response.json({ sid: "SMfake", status: "queued" }, { status: 201 });

interface CapturedRequest {
  url: string;
  method: string | undefined;
  headers: Headers;
  form: URLSearchParams;
}

/** Sender dengan fetch palsu yang merekam satu request. */
const senderWith = (env: PhoneEnv, respond: () => Response = created) => {
  const requests: CapturedRequest[] = [];
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    requests.push({
      form: new URLSearchParams(String(init?.body ?? "")),
      headers: new Headers(init?.headers),
      method: init?.method,
      url: String(input),
    });
    return Promise.resolve(respond());
  });
  return { requests, sender: createPhoneSender({ env, fetch: fetchMock }) };
};

const rejectionOf = async (promise: Promise<unknown>): Promise<PhoneError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PhoneError) {
      return error;
    }
    throw error;
  }
  throw new Error("diharapkan melempar PhoneError");
};

describe("payload REST Twilio (driver twilio)", () => {
  it("POST form-urlencoded ke Messages.json akun, Basic auth API Key", async () => {
    const { requests, sender } = senderWith(TWILIO_ENV);

    await sender.sendOtp({ code: CODE, phone: E164_ID });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json",
    });
    expect(requests[0]?.headers.get("content-type")).toBe(
      "application/x-www-form-urlencoded"
    );
    expect(requests[0]?.headers.get("authorization")).toBe(
      `Basic ${btoa("SKtest:fake-secret")}`
    );
  });

  it("WhatsApp: ContentSid + ContentVariables, MessagingServiceSid, To whatsapp:, tanpa Body", async () => {
    const { requests, sender } = senderWith(TWILIO_ENV);

    await sender.sendOtp({
      channel: "whatsapp",
      code: CODE,
      phone: "081234567890",
    });

    expect(Object.fromEntries(requests[0]?.form ?? [])).toStrictEqual({
      ContentSid: "HXtest",
      ContentVariables: JSON.stringify({ 1: CODE }),
      MessagingServiceSid: "MGtest",
      To: `whatsapp:${E164_ID}`,
    });
  });

  it("kanal default adalah WhatsApp", async () => {
    const { requests, sender } = senderWith(TWILIO_ENV);

    await sender.sendOtp({ code: CODE, phone: E164_ID });

    expect(requests[0]?.form.get("To")).toBe(`whatsapp:${E164_ID}`);
  });

  it("SMS: Body memuat kode, MessagingServiceSid, To E.164, tanpa ContentSid/From", async () => {
    const { requests, sender } = senderWith(TWILIO_ENV);

    await sender.sendOtp({
      channel: "sms",
      code: CODE,
      phone: "0812 3456 7890",
    });

    const form = requests[0]?.form;

    expect(form?.get("Body")).toContain(CODE);
    expect(form?.get("MessagingServiceSid")).toBe("MGtest");
    expect(form?.get("To")).toBe(E164_ID);
    expect([form?.has("ContentSid"), form?.has("From")]).toStrictEqual([
      false,
      false,
    ]);
  });
});

describe("payload REST Twilio (driver twilio-test)", () => {
  it.each(["whatsapp", "sms"] as const)(
    "kanal %s dikirim sebagai SMS dari magic number dengan Basic AccountSid:token",
    async (channel) => {
      const { requests, sender } = senderWith(TWILIO_TEST_ENV);

      await sender.sendOtp({ channel, code: CODE, phone: E164_ID });

      const [request] = requests;

      expect(request?.url).toBe(
        "https://api.twilio.com/2010-04-01/Accounts/ACsandbox/Messages.json"
      );
      expect(request?.headers.get("authorization")).toBe(
        `Basic ${btoa("ACsandbox:fake-token")}`
      );
      expect(Object.fromEntries(request?.form ?? [])).toStrictEqual({
        Body: expect.stringContaining(CODE),
        From: "+15005550006",
        To: E164_ID,
      });
    }
  );
});

/** Respons error Twilio; `message` sengaja memuat nomor + kode untuk uji kebocoran. */
const twilioError = (status: number, code?: number) => () =>
  Response.json(
    { code, message: `galat ${E164_ID} ${CODE}`, status },
    { status }
  );

describe("pemetaan error Twilio", () => {
  it.each([
    [400, 21_211, "INVALID_NUMBER"],
    [400, 21_614, "INVALID_NUMBER"],
    [400, 21_408, "UNSUPPORTED_DESTINATION"],
    [400, 21_612, "UNSUPPORTED_DESTINATION"],
    [400, 21_610, "RECIPIENT_UNREACHABLE"],
    [400, 63_003, "RECIPIENT_UNREACHABLE"],
    [429, 20_429, "RATE_LIMITED"],
    [401, 20_003, "PROVIDER_CONFIG"],
    [400, 99_999, "PROVIDER_ERROR"],
  ])("HTTP %i kode %i → %s", async (status, providerCode, expected) => {
    const { sender } = senderWith(
      TWILIO_ENV,
      twilioError(status, providerCode)
    );

    const error = await rejectionOf(
      sender.sendOtp({ code: CODE, phone: E164_ID })
    );

    expect(error.code).toBe(expected);
    expect(error.providerCode).toBe(providerCode);
  });

  it.each([
    [429, "RATE_LIMITED"],
    [401, "PROVIDER_CONFIG"],
    [500, "PROVIDER_ERROR"],
  ])("HTTP %i tanpa kode Twilio → %s", async (status, expected) => {
    const { sender } = senderWith(TWILIO_ENV, twilioError(status));

    const error = await rejectionOf(
      sender.sendOtp({ code: CODE, phone: E164_ID })
    );

    expect(error.code).toBe(expected);
  });

  it("body bukan JSON → PROVIDER_ERROR", async () => {
    const { sender } = senderWith(
      TWILIO_ENV,
      () => new Response("<html>bad gateway</html>", { status: 502 })
    );

    const error = await rejectionOf(
      sender.sendOtp({ code: CODE, phone: E164_ID })
    );

    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.providerCode).toBeUndefined();
  });

  it("fetch melempar (jaringan) → PROVIDER_ERROR", async () => {
    const sender = createPhoneSender({
      env: TWILIO_ENV,
      fetch: vi.fn<typeof fetch>(() =>
        Promise.reject(new TypeError(`network ${E164_ID} ${CODE}`))
      ),
    });

    const error = await rejectionOf(
      sender.sendOtp({ code: CODE, phone: E164_ID })
    );

    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.message).not.toContain(CODE);
    expect(error.message).not.toContain(E164_ID);
  });

  it.each([400, 401, 429, 502])(
    "pesan error HTTP %i tidak memuat kode OTP, nomor, atau secret",
    async (status) => {
      const { sender } = senderWith(TWILIO_ENV, twilioError(status, 21_211));

      const error = await rejectionOf(
        sender.sendOtp({ code: CODE, phone: E164_ID })
      );
      const serialized = `${error.message} ${JSON.stringify(error)}`;

      expect(serialized).not.toContain(CODE);
      expect(serialized).not.toContain("81234567890");
      expect(serialized).not.toContain("fake-secret");
    }
  );
});
