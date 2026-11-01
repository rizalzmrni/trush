/** Alasan gagal kirim yang bisa dipetakan ke pesan pengguna. */
export type PhoneErrorCode =
  /** Bukan nomor telepon valid. */
  | "INVALID_NUMBER"
  /** Negara di luar `PHONE_ALLOWED_COUNTRIES` atau ditolak penyedia. */
  | "UNSUPPORTED_DESTINATION"
  /** Nomor tidak ada di `PHONE_ALLOWLIST` (staging). */
  | "NOT_ALLOWLISTED"
  /** Penerima memblokir/berhenti berlangganan, atau tidak terdaftar WhatsApp. */
  | "RECIPIENT_UNREACHABLE"
  /** Penyedia membatasi laju pengiriman. */
  | "RATE_LIMITED"
  /** Kredensial/konfigurasi Twilio salah (bukan kesalahan pengguna). */
  | "PROVIDER_CONFIG"
  /** Error penyedia lain atau jaringan. */
  | "PROVIDER_ERROR";

/**
 * Error domain `@trush/phone`. Pesan tidak memuat kode OTP maupun nomor
 * lengkap; `providerCode` hanya kode numerik Twilio untuk diagnosis.
 */
export class PhoneError extends Error {
  readonly code: PhoneErrorCode;
  readonly providerCode: number | undefined;

  constructor(
    code: PhoneErrorCode,
    message: string,
    providerCode?: number | undefined
  ) {
    super(message);
    this.name = "PhoneError";
    this.code = code;
    this.providerCode = providerCode;
  }
}
