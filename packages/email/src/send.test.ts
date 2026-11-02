import { describe, expect, it, vi } from "vitest";

import { createEmailOutbox } from "./drivers/local";
import type { EmailOutboxEntry } from "./drivers/local";
import type { ResendClient } from "./drivers/resend";
import type { EmailEnv } from "./env";
import {
  digest,
  formatChangedAt,
  sendPasswordReset,
  sendPhoneNumberChanged,
  sendVerificationOtp,
} from "./send";
import { createEmailSender } from "./sender";

// Semua data palsu; Resend selalu tiruan.
const TO = "budi@example.com";
const USER_ID = "user_fake_123";
const CODE = "482913";
const TOKEN = "token-reset-palsu-0123456789";
const RESET_URL = `http://localhost:8787/api/auth/reset-password/${TOKEN}?callbackURL=http%3A%2F%2Flocalhost%3A5174%2Freset-password`;
const CHANGED_AT = new Date("2026-11-02T07:05:00Z");

const HEX_KEY = /^[0-9a-f]{32}$/u;
const OTP_KEY = /^verification-otp\/[0-9a-f]{32}$/u;
const RESET_KEY = /^password-reset\/user_fake_123\/[0-9a-f]{32}$/u;
/** Batas panjang `Idempotency-Key` Resend. */
const RESEND_KEY_MAX = 256;

const DEV_ENV: EmailEnv = {
  APP_ENV: "development",
  EMAIL_ALLOWLIST: undefined,
  EMAIL_DRIVER: "memory",
  EMAIL_FROM: undefined,
  RESEND_API_KEY: undefined,
};

const memorySender = () => {
  const outbox = createEmailOutbox();
  return { outbox, sender: createEmailSender({ env: DEV_ENV, outbox }) };
};

const only = (entries: readonly EmailOutboxEntry[]): EmailOutboxEntry => {
  expect(entries).toHaveLength(1);
  const [entry] = entries;
  if (entry === undefined) {
    throw new Error("outbox kosong");
  }
  return entry;
};

describe(digest, () => {
  it("deterministik, 32 heks, berbeda untuk masukan berbeda", async () => {
    const first = await digest("a");

    expect(first).toMatch(HEX_KEY);
    await expect(digest("a")).resolves.toBe(first);
    await expect(digest("b")).resolves.not.toBe(first);
  });
});

describe(sendVerificationOtp, () => {
  it("merender kode dan umur ke outbox dengan subjek & template", async () => {
    const { outbox, sender } = memorySender();

    await sendVerificationOtp(sender, {
      code: CODE,
      expiresInMinutes: 5,
      to: TO,
    });

    const entry = only(outbox.list());
    expect(entry).toMatchObject({
      code: CODE,
      subject: "Kode verifikasi email trush",
      template: "verification-otp",
      to: TO,
    });
    expect(entry.body).toContain(CODE);
    expect(entry.body).toContain("5 menit");
  });

  it("idempotencyKey tidak memuat kode maupun alamat", async () => {
    const { outbox, sender } = memorySender();

    await sendVerificationOtp(sender, {
      code: CODE,
      expiresInMinutes: 5,
      to: TO,
    });

    const { idempotencyKey } = only(outbox.list());
    expect(idempotencyKey).toMatch(OTP_KEY);
    expect(idempotencyKey).not.toContain(CODE);
    expect(idempotencyKey).not.toContain("budi");
  });

  it("kunci sama untuk alamat+kode sama (tanpa beda huruf), beda untuk kode/alamat lain", async () => {
    const { outbox, sender } = memorySender();

    await sendVerificationOtp(sender, {
      code: CODE,
      expiresInMinutes: 5,
      to: TO,
    });
    await sendVerificationOtp(sender, {
      code: CODE,
      expiresInMinutes: 5,
      to: " Budi@Example.com ",
    });
    await sendVerificationOtp(sender, {
      code: "111111",
      expiresInMinutes: 5,
      to: TO,
    });
    await sendVerificationOtp(sender, {
      code: CODE,
      expiresInMinutes: 5,
      to: "ani@example.com",
    });

    const [first, sameAgain, newCode, otherAddress] = outbox
      .list()
      .map((entry) => entry.idempotencyKey);
    expect(sameAgain).toBe(first);
    expect(newCode).not.toBe(first);
    expect(otherAddress).not.toBe(first);
  });
});

describe(sendPasswordReset, () => {
  const input = {
    expiresInMinutes: 60,
    to: TO,
    token: TOKEN,
    url: RESET_URL,
    userId: USER_ID,
  };

  it("merender tautan utuh dan umur; code null", async () => {
    const { outbox, sender } = memorySender();

    await sendPasswordReset(sender, input);

    const entry = only(outbox.list());
    expect(entry).toMatchObject({
      code: null,
      subject: "Atur ulang kata sandi trush",
      template: "password-reset",
      to: TO,
    });
    expect(entry.body).toContain(RESET_URL);
    expect(entry.body).toContain("60 menit");
  });

  it("idempotencyKey password-reset/<userId>/<hash token>, tanpa token mentah", async () => {
    const { outbox, sender } = memorySender();

    await sendPasswordReset(sender, input);
    await sendPasswordReset(sender, input);
    await sendPasswordReset(sender, { ...input, token: "token-lain-palsu" });

    const [first, again, other] = outbox
      .list()
      .map((entry) => entry.idempotencyKey);
    expect(first).toMatch(RESET_KEY);
    expect(first).not.toContain(TOKEN);
    expect(again).toBe(first);
    expect(other).not.toBe(first);
  });
});

describe(sendPhoneNumberChanged, () => {
  it("merender nomor tersamar dan waktu WIB; kunci per userId + waktu", async () => {
    const { outbox, sender } = memorySender();

    await sendPhoneNumberChanged(sender, {
      changedAt: CHANGED_AT,
      maskedPhoneNumber: "+62812****7890",
      to: TO,
      userId: USER_ID,
    });

    const entry = only(outbox.list());
    expect(entry).toMatchObject({
      code: null,
      idempotencyKey: `phone-number-changed/${USER_ID}/${CHANGED_AT.getTime()}`,
      subject: "Nomor telepon akun trush diubah",
      template: "phone-number-changed",
      to: TO,
    });
    expect(entry.body).toContain("+62812****7890");
    expect(entry.body).toContain("2 November 2026 pukul 14.05 WIB");
  });
});

describe(formatChangedAt, () => {
  it.each([
    ["2026-11-02T07:05:00Z", "2 November 2026 pukul 14.05 WIB"],
    ["2026-12-31T20:30:00Z", "1 Januari 2027 pukul 03.30 WIB"],
  ])("%s → %s (Asia/Jakarta)", (iso, expected) => {
    expect(formatChangedAt(new Date(iso))).toBe(expected);
  });
});

describe("lewat driver resend (SDK tiruan)", () => {
  it.each([
    [
      "verification-otp",
      (sender: Parameters<typeof sendVerificationOtp>[0]) =>
        sendVerificationOtp(sender, {
          code: CODE,
          expiresInMinutes: 5,
          to: TO,
        }),
    ],
    [
      "password-reset",
      (sender: Parameters<typeof sendPasswordReset>[0]) =>
        sendPasswordReset(sender, {
          expiresInMinutes: 60,
          to: TO,
          token: TOKEN,
          url: RESET_URL,
          userId: USER_ID,
        }),
    ],
    [
      "phone-number-changed",
      (sender: Parameters<typeof sendPhoneNumberChanged>[0]) =>
        sendPhoneNumberChanged(sender, {
          changedAt: CHANGED_AT,
          maskedPhoneNumber: "+62812****7890",
          to: TO,
          userId: USER_ID,
        }),
    ],
  ])(
    "%s: html + teks + idempotencyKey sampai ke Resend",
    async (template, send) => {
      const resendSend = vi.fn<ResendClient["emails"]["send"]>(() =>
        Promise.resolve({ error: null })
      );
      const sender = createEmailSender({
        env: {
          ...DEV_ENV,
          APP_ENV: "production",
          EMAIL_DRIVER: "resend",
          EMAIL_FROM: "trush <noreply@example.com>",
          RESEND_API_KEY: "re_fake",
        },
        resendClient: { emails: { send: resendSend } },
      });

      await send(sender);

      expect(resendSend).toHaveBeenCalledOnce();
      const [payload, options] = resendSend.mock.calls[0] ?? [];
      expect(payload).toMatchObject({
        html: expect.stringMatching(/^<!DOCTYPE html/u),
        tags: [{ name: "template", value: template }],
        text: expect.not.stringContaining("<"),
      });
      expect(options?.idempotencyKey).toMatch(
        new RegExp(`^${template}/[^/]`, "u")
      );
      expect(options?.idempotencyKey?.length).toBeLessThanOrEqual(
        RESEND_KEY_MAX
      );
    }
  );
});
