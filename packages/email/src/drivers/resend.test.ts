import type { Resend } from "resend";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailError } from "../errors";
import { createResendTransport } from "./resend";
import type { ResendClient } from "./resend";
import type { EmailMessage } from "./types";

// SDK Resend asli disubkelas; `emails.send` selalu diganti tiruan, jadi
// tidak ada request ke Resend nyata.
const sdk = vi.hoisted(() => ({
  apiKeys: [] as (string | undefined)[],
  send: vi.fn<Resend["emails"]["send"]>(),
}));

vi.mock(import("resend"), async (importOriginal) => {
  const original = await importOriginal();
  class FakeResend extends original.Resend {
    constructor(apiKey?: string) {
      super(apiKey);
      sdk.apiKeys.push(apiKey);
      vi.spyOn(this.emails, "send").mockImplementation(sdk.send);
    }
  }
  return { ...original, Resend: FakeResend };
});

// Semua nilai palsu.
const API_KEY = "re_fake-secret-key-0123456789";
const FROM = "trush <noreply@example.com>";
const TO = "budi@example.com";
const CODE = "482913";

const MESSAGE: EmailMessage = {
  code: CODE,
  html: `<p>${CODE}</p>`,
  idempotencyKey: "verification-otp/0123456789abcdef0123456789abcdef",
  subject: "Kode verifikasi email trush",
  template: "verification-otp",
  text: `Kode Anda ${CODE}`,
  to: TO,
};

type SendResult = Awaited<ReturnType<ResendClient["emails"]["send"]>>;

const fakeClient = (
  respond: () => Promise<SendResult> = () => Promise.resolve({ error: null })
) => {
  const send = vi.fn<ResendClient["emails"]["send"]>(respond);
  return { client: { emails: { send } } satisfies ResendClient, send };
};

const rejectionOf = async (promise: Promise<unknown>): Promise<EmailError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof EmailError) {
      return error;
    }
    throw error;
  }
  throw new Error("diharapkan melempar EmailError");
};

/** Pesan error tidak memuat alamat, kode, isi, atau kunci API. */
const expectNoPii = (error: EmailError) => {
  for (const value of [TO, CODE, API_KEY, MESSAGE.text]) {
    expect(error.message).not.toContain(value);
  }
};

describe(createResendTransport, () => {
  beforeEach(() => {
    sdk.apiKeys.length = 0;
    sdk.send.mockReset();
  });

  it("mengirim payload lengkap + idempotencyKey ke SDK", async () => {
    const { client, send } = fakeClient();

    await createResendTransport({ apiKey: API_KEY, client, from: FROM }).send(
      MESSAGE
    );

    expect(send).toHaveBeenCalledExactlyOnceWith(
      {
        from: FROM,
        html: MESSAGE.html,
        subject: MESSAGE.subject,
        tags: [{ name: "template", value: "verification-otp" }],
        text: MESSAGE.text,
        to: TO,
      },
      { idempotencyKey: MESSAGE.idempotencyKey }
    );
  });

  it("tanpa client memakai SDK Resend dengan kunci dari opsi", async () => {
    sdk.send.mockResolvedValue({
      data: { id: "fake-email-id" },
      error: null,
      headers: null,
    });

    await createResendTransport({ apiKey: API_KEY, from: FROM }).send(MESSAGE);

    expect(sdk.apiKeys).toStrictEqual([API_KEY]);
    expect(sdk.send).toHaveBeenCalledOnce();
  });

  it.each([
    ["invalid_api_key", "PROVIDER_CONFIG"],
    ["missing_api_key", "PROVIDER_CONFIG"],
    ["restricted_api_key", "PROVIDER_CONFIG"],
    ["invalid_access", "PROVIDER_CONFIG"],
    ["invalid_from_address", "PROVIDER_CONFIG"],
    ["rate_limit_exceeded", "RATE_LIMITED"],
    ["daily_quota_exceeded", "RATE_LIMITED"],
    ["monthly_quota_exceeded", "RATE_LIMITED"],
    ["validation_error", "PROVIDER_ERROR"],
    ["application_error", "PROVIDER_ERROR"],
  ])("error Resend %s → EmailError %s", async (name, code) => {
    const { client } = fakeClient(() =>
      Promise.resolve({
        error: { message: `Alamat ${TO} ditolak, kode ${CODE}`, name },
      })
    );

    const error = await rejectionOf(
      createResendTransport({ apiKey: API_KEY, client, from: FROM }).send(
        MESSAGE
      )
    );

    expect(error.code).toBe(code);
    expect(error.providerCode).toBe(name);
    expect(error.message).toContain(name);
    expectNoPii(error);
  });

  it("SDK melempar (jaringan) → PROVIDER_ERROR dengan cause, tanpa PII", async () => {
    const cause = new TypeError("fetch failed");
    const { client } = fakeClient(() => Promise.reject(cause));

    const error = await rejectionOf(
      createResendTransport({ apiKey: API_KEY, client, from: FROM }).send(
        MESSAGE
      )
    );

    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.cause).toBe(cause);
    expect(error.providerCode).toBeUndefined();
    expectNoPii(error);
  });
});
