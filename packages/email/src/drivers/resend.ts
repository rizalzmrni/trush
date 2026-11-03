import { Resend } from "resend";
import type { CreateEmailOptions, CreateEmailRequestOptions } from "resend";

import { EmailError } from "../errors";
import type { EmailErrorCode } from "../errors";
import type { EmailTransport } from "./types";

/** Bagian SDK Resend yang dipakai; test menyuntik tiruan (tanpa Resend nyata). */
export interface ResendClient {
  emails: {
    send: (
      payload: CreateEmailOptions,
      options?: CreateEmailRequestOptions
    ) => Promise<{
      error: { name: string; message: string } | null;
    }>;
  };
}

const CONFIG_ERRORS: ReadonlySet<string> = new Set([
  "invalid_access",
  "invalid_api_key",
  "invalid_from_address",
  "missing_api_key",
  "restricted_api_key",
]);

const RATE_ERRORS: ReadonlySet<string> = new Set([
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
  "rate_limit_exceeded",
]);

const toErrorCode = (name: string): EmailErrorCode => {
  if (CONFIG_ERRORS.has(name)) {
    return "PROVIDER_CONFIG";
  }
  if (RATE_ERRORS.has(name)) {
    return "RATE_LIMITED";
  }
  return "PROVIDER_ERROR";
};

export interface ResendTransportOptions {
  apiKey: string;
  from: string;
  /** Pengganti SDK (test). */
  client?: ResendClient | undefined;
}

/**
 * Driver `resend`. `idempotencyKey` diteruskan ke header `Idempotency-Key`
 * Resend; tag `template` untuk analitik di dasbor Resend. Pesan error hanya
 * memuat nama error Resend, bukan alamat atau isi.
 */
export const createResendTransport = ({
  apiKey,
  client = new Resend(apiKey),
  from,
}: ResendTransportOptions): EmailTransport => ({
  send: async ({ html, idempotencyKey, subject, template, text, to }) => {
    let result: Awaited<ReturnType<ResendClient["emails"]["send"]>>;
    try {
      result = await client.emails.send(
        {
          from,
          html,
          subject,
          tags: [{ name: "template", value: template }],
          text,
          to,
        },
        { idempotencyKey }
      );
    } catch (error) {
      throw new EmailError("PROVIDER_ERROR", "Gagal menghubungi Resend.", {
        cause: error,
      });
    }
    if (result.error !== null) {
      throw new EmailError(
        toErrorCode(result.error.name),
        `Resend menolak email (${result.error.name}).`,
        { providerCode: result.error.name }
      );
    }
  },
});
