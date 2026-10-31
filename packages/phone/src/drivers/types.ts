/** Kanal pengiriman OTP; WhatsApp default, SMS untuk "kirim ulang via SMS". */
export type OtpChannel = "whatsapp" | "sms";

/** Pesan OTP yang sudah lolos normalisasi dan guard nomor. */
export interface OtpMessage {
  channel: OtpChannel;
  code: string;
  /** Nomor E.164. */
  to: string;
}

/** Satu driver pengirim; melempar `PhoneError` bila gagal. */
export interface PhoneTransport {
  send: (message: OtpMessage) => Promise<void>;
}
