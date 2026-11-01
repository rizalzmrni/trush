import type { ApiEnv } from "@trush/env/api";

import {
  createLogTransport,
  createMemoryTransport,
  defaultOutbox,
} from "./drivers/local";
import type { Outbox, PhoneLogger } from "./drivers/local";
import {
  createTwilioTransport,
  liveMessageFields,
  testMessageFields,
} from "./drivers/twilio";
import type { OtpChannel, PhoneTransport } from "./drivers/types";
import { PhoneError } from "./errors";
import { resolveRecipient, toE164 } from "./number";
import type { NumberPolicy } from "./number";

/** Bagian env api yang dibaca `@trush/phone`; divalidasi `createApiEnv`. */
export type PhoneEnv = Pick<
  ApiEnv,
  | "APP_ENV"
  | "PHONE_ALLOWED_COUNTRIES"
  | "PHONE_ALLOWLIST"
  | "PHONE_DRIVER"
  | "TWILIO_ACCOUNT_SID"
  | "TWILIO_API_KEY_SECRET"
  | "TWILIO_API_KEY_SID"
  | "TWILIO_MESSAGING_SERVICE_SID"
  | "TWILIO_TEST_ACCOUNT_SID"
  | "TWILIO_TEST_AUTH_TOKEN"
  | "TWILIO_WHATSAPP_OTP_CONTENT_SID"
>;

export interface CreatePhoneSenderOptions {
  env: PhoneEnv;
  /** Wajib untuk driver `log`. */
  logger?: PhoneLogger | undefined;
  /** Driver `memory`; default `defaultOutbox`. */
  outbox?: Outbox | undefined;
  /** Pengganti `fetch` (test). */
  fetch?: typeof fetch | undefined;
}

export interface SendOtpInput {
  /** Nomor apa pun yang bisa dinormalisasi; dikirim ke E.164-nya. */
  phone: string;
  code: string;
  /** Default `whatsapp`. */
  channel?: OtpChannel | undefined;
}

export interface PhoneSender {
  readonly driver: PhoneEnv["PHONE_DRIVER"];
  /** E.164 dari input (negara default = entri pertama allowed countries). */
  normalize: (phone: string) => string | undefined;
  /** `true` bila nomor valid, negaranya diizinkan, dan lolos allowlist. */
  canSendTo: (phone: string) => boolean;
  /** Kirim OTP; melempar `PhoneError` tanpa memanggil penyedia bila nomor ditolak. */
  sendOtp: (input: SendOtpInput) => Promise<void>;
}

const requireValue = (value: string | undefined, name: string): string => {
  if (value === undefined) {
    throw new PhoneError("PROVIDER_CONFIG", `${name} belum diisi.`);
  }
  return value;
};

const createTransport = ({
  env,
  fetch: fetchImpl,
  logger,
  outbox,
}: CreatePhoneSenderOptions): PhoneTransport => {
  switch (env.PHONE_DRIVER) {
    case "memory": {
      return createMemoryTransport(outbox ?? defaultOutbox);
    }
    case "log": {
      if (!logger) {
        throw new PhoneError("PROVIDER_CONFIG", "Driver log butuh logger.");
      }
      return createLogTransport(logger);
    }
    case "twilio-test": {
      const accountSid = requireValue(
        env.TWILIO_TEST_ACCOUNT_SID,
        "TWILIO_TEST_ACCOUNT_SID"
      );
      return createTwilioTransport({
        buildFields: testMessageFields,
        credentials: {
          accountSid,
          password: requireValue(
            env.TWILIO_TEST_AUTH_TOKEN,
            "TWILIO_TEST_AUTH_TOKEN"
          ),
          username: accountSid,
        },
        fetch: fetchImpl,
      });
    }
    case "twilio": {
      return createTwilioTransport({
        buildFields: liveMessageFields({
          messagingServiceSid: requireValue(
            env.TWILIO_MESSAGING_SERVICE_SID,
            "TWILIO_MESSAGING_SERVICE_SID"
          ),
          whatsappOtpContentSid: requireValue(
            env.TWILIO_WHATSAPP_OTP_CONTENT_SID,
            "TWILIO_WHATSAPP_OTP_CONTENT_SID"
          ),
        }),
        credentials: {
          accountSid: requireValue(
            env.TWILIO_ACCOUNT_SID,
            "TWILIO_ACCOUNT_SID"
          ),
          password: requireValue(
            env.TWILIO_API_KEY_SECRET,
            "TWILIO_API_KEY_SECRET"
          ),
          username: requireValue(env.TWILIO_API_KEY_SID, "TWILIO_API_KEY_SID"),
        },
        fetch: fetchImpl,
      });
    }
    default: {
      throw new PhoneError("PROVIDER_CONFIG", "PHONE_DRIVER tidak dikenal.");
    }
  }
};

/**
 * Pengirim OTP per request. Driver dari `PHONE_DRIVER`; production hanya
 * `twilio` (juga ditegakkan `createApiEnv`). Allowlist berlaku bila diisi.
 */
export const createPhoneSender = (
  options: CreatePhoneSenderOptions
): PhoneSender => {
  const { env } = options;
  if (env.APP_ENV === "production" && env.PHONE_DRIVER !== "twilio") {
    throw new PhoneError(
      "PROVIDER_CONFIG",
      "PHONE_DRIVER wajib twilio saat APP_ENV=production."
    );
  }
  const policy: NumberPolicy = {
    allowedCountries: env.PHONE_ALLOWED_COUNTRIES,
    allowlist: env.PHONE_ALLOWLIST,
  };
  const transport = createTransport(options);
  return {
    canSendTo: (phone) => {
      try {
        resolveRecipient(phone, policy);
        return true;
      } catch {
        return false;
      }
    },
    driver: env.PHONE_DRIVER,
    normalize: (phone) => toE164(phone, policy.allowedCountries[0]),
    sendOtp: async ({ channel = "whatsapp", code, phone }) => {
      const to = resolveRecipient(phone, policy);
      await transport.send({ channel, code, to });
    },
  };
};
