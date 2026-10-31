import { PhoneError } from "../errors";
import type { PhoneErrorCode } from "../errors";
import type { OtpMessage, PhoneTransport } from "./types";

const TWILIO_API_ORIGIN = "https://api.twilio.com";

/** Pengirim magic number test credentials: selalu "berhasil" tanpa biaya. */
export const TWILIO_TEST_FROM = "+15005550006";

/** Isi SMS OTP. WhatsApp memakai template yang disetujui Meta, bukan teks ini. */
export const smsOtpBody = (code: string): string =>
  `Kode verifikasi trush: ${code}. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.`;

/**
 * Kode error Twilio → error domain. Daftar: https://www.twilio.com/docs/api/errors
 * Kode lain jatuh ke `PROVIDER_ERROR`.
 */
const ERROR_BY_TWILIO_CODE: Readonly<Record<number, PhoneErrorCode>> = {
  // Invalid 'To' phone number / not a mobile number.
  21_211: "INVALID_NUMBER",
  21_614: "INVALID_NUMBER",
  // Permission to send to this region not enabled / unsupported destination.
  21_408: "UNSUPPORTED_DESTINATION",
  21_612: "UNSUPPORTED_DESTINATION",
  // Recipient unsubscribed (STOP) / blocked / not a WhatsApp user.
  21_610: "RECIPIENT_UNREACHABLE",
  63_003: "RECIPIENT_UNREACHABLE",
  // Too many requests.
  20_429: "RATE_LIMITED",
  14_107: "RATE_LIMITED",
  // Authentication / account / configuration errors.
  20_003: "PROVIDER_CONFIG",
  20_404: "PROVIDER_CONFIG",
  21_606: "PROVIDER_CONFIG",
  21_659: "PROVIDER_CONFIG",
  63_007: "PROVIDER_CONFIG",
  63_016: "PROVIDER_CONFIG",
};

/** Cadangan bila body tidak memuat kode Twilio yang dikenal. */
const ERROR_BY_HTTP_STATUS: Readonly<Record<number, PhoneErrorCode>> = {
  401: "PROVIDER_CONFIG",
  429: "RATE_LIMITED",
};

interface TwilioErrorBody {
  code?: unknown;
}

/** Memetakan respons gagal Twilio ke `PhoneError` tanpa membawa isi permintaan. */
export const toPhoneError = async (response: Response): Promise<PhoneError> => {
  let providerCode: number | undefined;
  try {
    const body = (await response.json()) as TwilioErrorBody;
    providerCode = typeof body.code === "number" ? body.code : undefined;
  } catch {
    providerCode = undefined;
  }
  const byStatus = ERROR_BY_HTTP_STATUS[response.status];
  const code =
    (providerCode === undefined
      ? undefined
      : ERROR_BY_TWILIO_CODE[providerCode]) ??
    byStatus ??
    "PROVIDER_ERROR";
  return new PhoneError(
    code,
    `Twilio menolak pesan (HTTP ${response.status}${providerCode === undefined ? "" : `, kode ${providerCode}`}).`,
    providerCode
  );
};

export interface TwilioCredentials {
  /** Akun pemilik resource `Messages` di URL. */
  accountSid: string;
  /** Basic auth: API Key SID (live) atau Account SID (test credentials). */
  username: string;
  password: string;
}

/** Field form `POST /Messages.json` untuk satu OTP. */
export type TwilioMessageFields = Record<string, string>;

export interface TwilioTransportOptions {
  credentials: TwilioCredentials;
  /** Menyusun field form; driver `twilio` dan `twilio-test` berbeda di sini. */
  buildFields: (message: OtpMessage) => TwilioMessageFields;
  fetch?: typeof fetch | undefined;
}

/** Transport REST Twilio Programmable Messaging lewat `fetch` (tanpa SDK). */
export const createTwilioTransport = ({
  buildFields,
  credentials,
  fetch: fetchImpl = fetch,
}: TwilioTransportOptions): PhoneTransport => {
  const url = `${TWILIO_API_ORIGIN}/2010-04-01/Accounts/${encodeURIComponent(credentials.accountSid)}/Messages.json`;
  const authorization = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
  return {
    send: async (message) => {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          body: new URLSearchParams(buildFields(message)),
          headers: {
            accept: "application/json",
            authorization,
            "content-type": "application/x-www-form-urlencoded",
          },
          method: "POST",
        });
      } catch {
        throw new PhoneError("PROVIDER_ERROR", "Twilio tidak dapat dihubungi.");
      }
      // 201 = masuk antrean Twilio, bukan terkirim (status akhir lewat callback).
      if (!response.ok) {
        throw await toPhoneError(response);
      }
    },
  };
};

export interface LiveTwilioConfig {
  messagingServiceSid: string;
  whatsappOtpContentSid: string;
}

/**
 * Field driver `twilio`: WhatsApp lewat template autentikasi (`ContentSid` +
 * `ContentVariables`, variabel `1` = kode), SMS lewat Messaging Service.
 */
export const liveMessageFields =
  ({ messagingServiceSid, whatsappOtpContentSid }: LiveTwilioConfig) =>
  ({ channel, code, to }: OtpMessage): TwilioMessageFields =>
    channel === "whatsapp"
      ? {
          ContentSid: whatsappOtpContentSid,
          ContentVariables: JSON.stringify({ 1: code }),
          MessagingServiceSid: messagingServiceSid,
          To: `whatsapp:${to}`,
        }
      : {
          Body: smsOtpBody(code),
          MessagingServiceSid: messagingServiceSid,
          To: to,
        };

/**
 * Field driver `twilio-test`: test credentials hanya mendukung SMS dari magic
 * number, jadi kanal WhatsApp juga dikirim sebagai SMS uji.
 */
export const testMessageFields = ({
  code,
  to,
}: OtpMessage): TwilioMessageFields => ({
  Body: smsOtpBody(code),
  From: TWILIO_TEST_FROM,
  To: to,
});
