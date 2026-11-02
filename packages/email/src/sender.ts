import { resolveRecipient } from "./address";
import {
  createLogTransport,
  createMemoryTransport,
  defaultEmailOutbox,
} from "./drivers/local";
import type { EmailLogger, EmailOutbox } from "./drivers/local";
import { createResendTransport } from "./drivers/resend";
import type { ResendClient } from "./drivers/resend";
import type { EmailMessage, EmailTransport } from "./drivers/types";
import type { EmailEnv } from "./env";
import { EmailError } from "./errors";

export interface CreateEmailSenderOptions {
  env: EmailEnv;
  /** Wajib untuk driver `log`. */
  logger?: EmailLogger | undefined;
  /** Driver `memory`; default `defaultEmailOutbox`. */
  outbox?: EmailOutbox | undefined;
  /** Pengganti SDK Resend (test). */
  resendClient?: ResendClient | undefined;
}

export interface EmailSender {
  readonly driver: EmailEnv["EMAIL_DRIVER"];
  /** `true` bila alamat valid dan lolos `EMAIL_ALLOWLIST`. */
  canSendTo: (address: string) => boolean;
  /**
   * Kirim email yang sudah dirender. Melempar `EmailError` tanpa memanggil
   * penyedia bila alamat ditolak.
   */
  send: (message: EmailMessage) => Promise<void>;
}

const requireValue = (value: string | undefined, name: string): string => {
  if (value === undefined) {
    throw new EmailError("PROVIDER_CONFIG", `${name} belum diisi.`);
  }
  return value;
};

const createTransport = ({
  env,
  logger,
  outbox,
  resendClient,
}: CreateEmailSenderOptions): EmailTransport => {
  switch (env.EMAIL_DRIVER) {
    case "memory": {
      return createMemoryTransport(outbox ?? defaultEmailOutbox);
    }
    case "log": {
      if (!logger) {
        throw new EmailError("PROVIDER_CONFIG", "Driver log butuh logger.");
      }
      return createLogTransport(logger);
    }
    case "resend": {
      return createResendTransport({
        apiKey: requireValue(env.RESEND_API_KEY, "RESEND_API_KEY"),
        client: resendClient,
        from: requireValue(env.EMAIL_FROM, "EMAIL_FROM"),
      });
    }
    default: {
      throw new EmailError("PROVIDER_CONFIG", "EMAIL_DRIVER tidak dikenal.");
    }
  }
};

/**
 * Pengirim email per request. Driver dari `EMAIL_DRIVER`; production hanya
 * `resend` (juga ditegakkan `createApiEnv`). Allowlist berlaku bila diisi.
 * Transport dibuat saat kirim pertama, jadi membuat sender (mis. di setiap
 * `createAuth`) tidak gagal hanya karena konfigurasi kirim belum lengkap.
 */
export const createEmailSender = (
  options: CreateEmailSenderOptions
): EmailSender => {
  const { env } = options;
  if (env.APP_ENV === "production" && env.EMAIL_DRIVER !== "resend") {
    throw new EmailError(
      "PROVIDER_CONFIG",
      "EMAIL_DRIVER wajib resend saat APP_ENV=production."
    );
  }
  let transport: EmailTransport | undefined;
  return {
    canSendTo: (address) => {
      try {
        resolveRecipient(address, env);
        return true;
      } catch {
        return false;
      }
    },
    driver: env.EMAIL_DRIVER,
    send: async (message) => {
      const to = resolveRecipient(message.to, env);
      transport ??= createTransport(options);
      await transport.send({ ...message, to });
    },
  };
};
