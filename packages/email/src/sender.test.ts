import { describe, expect, it, vi } from "vitest";

import { createEmailOutbox, defaultEmailOutbox } from "./drivers/local";
import type { ResendClient } from "./drivers/resend";
import type { EmailMessage } from "./drivers/types";
import type { EmailEnv } from "./env";
import { EmailError } from "./errors";
import { createEmailSender } from "./sender";

// Semua nilai palsu; Resend selalu tiruan.
const DEV_ENV: EmailEnv = {
  APP_ENV: "development",
  EMAIL_ALLOWLIST: undefined,
  EMAIL_DRIVER: "memory",
  EMAIL_FROM: undefined,
  RESEND_API_KEY: undefined,
};

const RESEND_ENV: EmailEnv = {
  APP_ENV: "production",
  EMAIL_ALLOWLIST: undefined,
  EMAIL_DRIVER: "resend",
  EMAIL_FROM: "trush <noreply@example.com>",
  RESEND_API_KEY: "re_fake-secret-key",
};

const message = (overrides: Partial<EmailMessage> = {}): EmailMessage => ({
  code: "482913",
  html: "<p>482913</p>",
  idempotencyKey: "verification-otp/abc",
  subject: "Kode verifikasi email trush",
  template: "verification-otp",
  text: "Kode Anda 482913",
  to: "budi@example.com",
  ...overrides,
});

const fakeResend = () => {
  const send = vi.fn<ResendClient["emails"]["send"]>(() =>
    Promise.resolve({ error: null })
  );
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

const errorOf = (run: () => unknown): EmailError => {
  try {
    run();
  } catch (error) {
    if (error instanceof EmailError) {
      return error;
    }
    throw error;
  }
  throw new Error("diharapkan melempar EmailError");
};

describe("pemilihan driver", () => {
  it("memory: email masuk ke outbox yang diberikan", async () => {
    const outbox = createEmailOutbox();
    const sender = createEmailSender({ env: DEV_ENV, outbox });

    await sender.send(message());

    expect(sender.driver).toBe("memory");
    expect(outbox.list()).toHaveLength(1);
  });

  it("memory tanpa outbox memakai defaultEmailOutbox", async () => {
    defaultEmailOutbox.clear();
    const sender = createEmailSender({ env: DEV_ENV });

    await sender.send(message({ to: "default-outbox@example.com" }));

    expect(
      defaultEmailOutbox.latestFor("default-outbox@example.com")
    ).toBeDefined();
    defaultEmailOutbox.clear();
  });

  it("log: memanggil logger dengan alamat disamarkan", async () => {
    const info =
      vi.fn<(text: string, properties?: Record<string, unknown>) => void>();
    const sender = createEmailSender({
      env: { ...DEV_ENV, EMAIL_DRIVER: "log" },
      logger: { info },
    });

    await sender.send(message());

    expect(sender.driver).toBe("log");
    expect(info).toHaveBeenCalledOnce();
    expect(JSON.stringify(info.mock.calls)).not.toContain("budi@example.com");
  });

  it("log tanpa logger: pembuatan sender aman, kirim gagal PROVIDER_CONFIG", async () => {
    const sender = createEmailSender({
      env: { ...DEV_ENV, EMAIL_DRIVER: "log" },
    });

    const error = await rejectionOf(sender.send(message()));

    expect(error.code).toBe("PROVIDER_CONFIG");
  });

  it("resend: memanggil SDK tiruan, bukan outbox", async () => {
    const outbox = createEmailOutbox();
    const { client, send } = fakeResend();
    const sender = createEmailSender({
      env: RESEND_ENV,
      outbox,
      resendClient: client,
    });

    await sender.send(message());

    expect(sender.driver).toBe("resend");
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      from: "trush <noreply@example.com>",
      to: "budi@example.com",
    });
    expect(outbox.list()).toStrictEqual([]);
  });

  it.each(["EMAIL_FROM", "RESEND_API_KEY"] as const)(
    "resend tanpa %s: pembuatan sender aman, kirim gagal PROVIDER_CONFIG tanpa nilai secret",
    async (name) => {
      const { client, send } = fakeResend();
      const sender = createEmailSender({
        env: { ...RESEND_ENV, APP_ENV: "development", [name]: undefined },
        resendClient: client,
      });

      const error = await rejectionOf(sender.send(message()));

      expect(error.code).toBe("PROVIDER_CONFIG");
      expect(error.message).toContain(name);
      expect(error.message).not.toContain("re_fake-secret-key");
      expect(send).not.toHaveBeenCalled();
    }
  );

  it.each(["memory", "log"] as const)(
    "production + %s ditolak saat sender dibuat",
    (driver) => {
      const error = errorOf(() =>
        createEmailSender({
          env: { ...RESEND_ENV, EMAIL_DRIVER: driver },
          logger: {
            info: vi.fn<
              (text: string, properties?: Record<string, unknown>) => void
            >(),
          },
        })
      );

      expect(error.code).toBe("PROVIDER_CONFIG");
    }
  );
});

describe("guard penerima", () => {
  it("alamat dinormalisasi (huruf kecil, dipangkas) sebelum ke driver", async () => {
    const { client, send } = fakeResend();
    const sender = createEmailSender({ env: RESEND_ENV, resendClient: client });

    await sender.send(message({ to: "  Budi@Example.COM " }));

    expect(send.mock.calls[0]?.[0].to).toBe("budi@example.com");
  });

  it("alamat tidak valid: INVALID_ADDRESS, penyedia tidak dipanggil", async () => {
    const { client, send } = fakeResend();
    const sender = createEmailSender({ env: RESEND_ENV, resendClient: client });

    const error = await rejectionOf(sender.send(message({ to: "rahasia@" })));

    expect(error.code).toBe("INVALID_ADDRESS");
    expect(error.message).not.toContain("rahasia");
    expect(send).not.toHaveBeenCalled();
  });

  it("di luar EMAIL_ALLOWLIST: NOT_ALLOWLISTED, penyedia tidak dipanggil", async () => {
    const { client, send } = fakeResend();
    const sender = createEmailSender({
      env: {
        ...RESEND_ENV,
        APP_ENV: "staging",
        EMAIL_ALLOWLIST: ["@example.com"],
      },
      resendClient: client,
    });

    const error = await rejectionOf(
      sender.send(message({ to: "orang@luar.test" }))
    );

    expect(error.code).toBe("NOT_ALLOWLISTED");
    expect(error.message).not.toContain("orang@luar.test");
    expect(send).not.toHaveBeenCalled();
  });

  it("allowlist juga berlaku untuk driver memory", async () => {
    const outbox = createEmailOutbox();
    const sender = createEmailSender({
      env: { ...DEV_ENV, EMAIL_ALLOWLIST: ["tim@example.com"] },
      outbox,
    });

    await expect(
      sender.send(message({ to: "lain@example.com" }))
    ).rejects.toThrow(EmailError);
    await sender.send(message({ to: "TIM@example.com" }));

    expect(outbox.list().map((entry) => entry.to)).toStrictEqual([
      "tim@example.com",
    ]);
  });

  it("canSendTo mengikuti validasi dan allowlist tanpa melempar", () => {
    const sender = createEmailSender({
      env: { ...DEV_ENV, EMAIL_ALLOWLIST: ["@example.com"] },
    });

    expect(sender.canSendTo("Budi@Example.com")).toBeTruthy();
    expect(sender.canSendTo("budi@luar.test")).toBeFalsy();
    expect(sender.canSendTo("bukan-email")).toBeFalsy();
  });
});
