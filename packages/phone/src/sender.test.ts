import { describe, expect, it, vi } from "vitest";

import { createOutbox } from "./drivers/local";
import type { PhoneLogger } from "./drivers/local";
import { PhoneError } from "./errors";
import { createPhoneSender } from "./sender";
import type { PhoneEnv } from "./sender";

// Semua kredensial palsu.
const E164_ID = "+6281234567890";
const OTHER_ID = "+6281299998888";
const MY_NUMBER = "+60123456789";
const CODE = "482913";

const MEMORY_ENV: PhoneEnv = {
  APP_ENV: "development",
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
};

const TWILIO_ENV: PhoneEnv = {
  ...MEMORY_ENV,
  APP_ENV: "production",
  PHONE_DRIVER: "twilio",
  TWILIO_ACCOUNT_SID: "ACtest",
  TWILIO_API_KEY_SECRET: "fake-secret",
  TWILIO_API_KEY_SID: "SKtest",
  TWILIO_MESSAGING_SERVICE_SID: "MGtest",
  TWILIO_WHATSAPP_OTP_CONTENT_SID: "HXtest",
};

const captureError = (run: () => unknown): PhoneError => {
  try {
    run();
  } catch (error) {
    if (error instanceof PhoneError) {
      return error;
    }
    throw error;
  }
  throw new Error("diharapkan melempar PhoneError");
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

describe("pemilihan driver", () => {
  it.each(["memory", "log", "twilio-test"] as const)(
    "production + %s → PROVIDER_CONFIG",
    (driver) => {
      const error = captureError(() =>
        createPhoneSender({
          env: {
            ...TWILIO_ENV,
            PHONE_DRIVER: driver,
            TWILIO_TEST_ACCOUNT_SID: "ACtest-sandbox",
            TWILIO_TEST_AUTH_TOKEN: "fake-token",
          },
          logger: { info: vi.fn<PhoneLogger["info"]>() },
        })
      );

      expect(error.code).toBe("PROVIDER_CONFIG");
      expect(error.message).toMatch(/production/u);
    }
  );

  it("production + twilio lengkap diterima", () => {
    expect(createPhoneSender({ env: TWILIO_ENV }).driver).toBe("twilio");
  });

  it.each([
    "TWILIO_ACCOUNT_SID",
    "TWILIO_API_KEY_SID",
    "TWILIO_API_KEY_SECRET",
    "TWILIO_MESSAGING_SERVICE_SID",
    "TWILIO_WHATSAPP_OTP_CONTENT_SID",
  ] as const)(
    "twilio tanpa %s → menyebut nama var tanpa nilai lain",
    (name) => {
      const error = captureError(() =>
        createPhoneSender({ env: { ...TWILIO_ENV, [name]: undefined } })
      );

      expect(error.code).toBe("PROVIDER_CONFIG");
      expect(error.message).toContain(name);
      expect(error.message).not.toMatch(
        /fake-secret|ACtest|SKtest|MGtest|HXtest/u
      );
    }
  );

  it.each(["TWILIO_TEST_ACCOUNT_SID", "TWILIO_TEST_AUTH_TOKEN"] as const)(
    "twilio-test tanpa %s → PROVIDER_CONFIG",
    (name) => {
      const env: PhoneEnv = {
        ...MEMORY_ENV,
        PHONE_DRIVER: "twilio-test",
        TWILIO_TEST_ACCOUNT_SID: "ACtest-sandbox",
        TWILIO_TEST_AUTH_TOKEN: "fake-token",
        [name]: undefined,
      };
      const error = captureError(() => createPhoneSender({ env }));

      expect(error.code).toBe("PROVIDER_CONFIG");
      expect(error.message).toContain(name);
    }
  );

  it("driver log tanpa logger → PROVIDER_CONFIG", () => {
    const error = captureError(() =>
      createPhoneSender({ env: { ...MEMORY_ENV, PHONE_DRIVER: "log" } })
    );

    expect(error.code).toBe("PROVIDER_CONFIG");
  });

  it.each(["development", "staging"] as const)(
    "%s boleh memakai memory",
    (appEnv) => {
      expect(
        createPhoneSender({ env: { ...MEMORY_ENV, APP_ENV: appEnv } }).driver
      ).toBe("memory");
    }
  );
});

describe("guard nomor", () => {
  it("canSendTo: true untuk nomor ID valid, false untuk negara lain/invalid", () => {
    const sender = createPhoneSender({
      env: MEMORY_ENV,
      outbox: createOutbox(),
    });

    expect(sender.canSendTo("0812-3456-7890")).toBeTruthy();
    expect(sender.canSendTo(MY_NUMBER)).toBeFalsy();
    expect(sender.canSendTo("abc")).toBeFalsy();
  });

  it("canSendTo menghormati allowlist", () => {
    const sender = createPhoneSender({
      env: { ...MEMORY_ENV, PHONE_ALLOWLIST: [E164_ID] },
      outbox: createOutbox(),
    });

    expect(sender.canSendTo("081234567890")).toBeTruthy();
    expect(sender.canSendTo(OTHER_ID)).toBeFalsy();
  });

  it("normalize memakai negara default entri pertama", () => {
    const sender = createPhoneSender({
      env: { ...MEMORY_ENV, PHONE_ALLOWED_COUNTRIES: ["MY", "ID"] },
      outbox: createOutbox(),
    });

    expect(sender.normalize("012-345 6789")).toBe(MY_NUMBER);
    expect(sender.normalize("abc")).toBeUndefined();
  });

  it.each([
    [MY_NUMBER, "UNSUPPORTED_DESTINATION"],
    [OTHER_ID, "NOT_ALLOWLISTED"],
    ["abc", "INVALID_NUMBER"],
  ])("sendOtp ke %s → %s tanpa memanggil fetch", async (phone, code) => {
    const fetchMock = vi.fn<typeof fetch>();
    const sender = createPhoneSender({
      env: { ...TWILIO_ENV, PHONE_ALLOWLIST: [E164_ID] },
      fetch: fetchMock,
    });

    const error = await rejectionOf(sender.sendOtp({ code: CODE, phone }));

    expect(error.code).toBe(code);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("driver memory", () => {
  it("menulis pesan E.164 ke outbox, kanal default whatsapp", async () => {
    const outbox = createOutbox();
    const sender = createPhoneSender({ env: MEMORY_ENV, outbox });

    await sender.sendOtp({ code: CODE, phone: "0812-3456-7890" });

    expect(outbox.latestFor(E164_ID)).toMatchObject({
      channel: "whatsapp",
      code: CODE,
      to: E164_ID,
    });
    expect(outbox.latestFor(E164_ID)?.sentAt).toBeInstanceOf(Date);
  });

  it("kanal sms diteruskan", async () => {
    const outbox = createOutbox();
    await createPhoneSender({ env: MEMORY_ENV, outbox }).sendOtp({
      channel: "sms",
      code: CODE,
      phone: E164_ID,
    });

    expect(outbox.list()).toStrictEqual([
      expect.objectContaining({ channel: "sms", to: E164_ID }),
    ]);
  });
});

/** Pesan uji ke-`index`: kode 6 digit, nomor bergantian. */
const message = (index: number) => ({
  channel: "sms" as const,
  code: String(index).padStart(6, "0"),
  to: index % 2 === 0 ? E164_ID : OTHER_ID,
});

describe(createOutbox, () => {
  it("latestFor mengembalikan pesan terakhir per nomor, undefined bila tidak ada", () => {
    const outbox = createOutbox();
    for (const index of [1, 2, 3, 4]) {
      outbox.add(message(index));
    }

    expect(outbox.latestFor(E164_ID)?.code).toBe("000004");
    expect(outbox.latestFor(OTHER_ID)?.code).toBe("000003");
    expect(outbox.latestFor(MY_NUMBER)).toBeUndefined();
  });

  it("list mengembalikan salinan, urut terlama ke terbaru", () => {
    const outbox = createOutbox();
    outbox.add(message(1));
    outbox.add(message(2));
    const snapshot = outbox.list();
    outbox.add(message(3));

    expect(snapshot.map((entry) => entry.code)).toStrictEqual([
      "000001",
      "000002",
    ]);
    expect(outbox.list()).toHaveLength(3);
  });

  it("dibatasi 50 entri, yang terlama dibuang", () => {
    const outbox = createOutbox();
    for (let index = 1; index <= 55; index += 1) {
      outbox.add(message(index));
    }
    const codes = outbox.list().map((entry) => entry.code);

    expect(codes).toHaveLength(50);
    expect(codes[0]).toBe("000006");
    expect(codes.at(-1)).toBe("000055");
  });

  it("clear mengosongkan outbox", () => {
    const outbox = createOutbox();
    outbox.add(message(1));
    outbox.clear();

    expect(outbox.list()).toStrictEqual([]);
    expect(outbox.latestFor(OTHER_ID)).toBeUndefined();
  });

  it("dua outbox terisolasi", () => {
    const first = createOutbox();
    const second = createOutbox();
    first.add(message(1));

    expect(second.list()).toStrictEqual([]);
  });
});

describe("driver log", () => {
  it("logger.info menerima kode OTP dan nomor tersamar, bukan nomor utuh", async () => {
    const info = vi.fn<PhoneLogger["info"]>();
    const sender = createPhoneSender({
      env: { ...MEMORY_ENV, PHONE_DRIVER: "log" },
      logger: { info },
    });

    await sender.sendOtp({ channel: "sms", code: CODE, phone: E164_ID });

    expect(info).toHaveBeenCalledOnce();

    const [messageText, properties] = info.mock.calls[0] ?? [];

    expect(properties).toStrictEqual({
      channel: "sms",
      otp: CODE,
      recipient: "+62812*****890",
    });
    expect(JSON.stringify([messageText, properties])).not.toContain(E164_ID);
  });
});
