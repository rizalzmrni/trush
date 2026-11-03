/** Alasan gagal kirim email. */
export type EmailErrorCode =
  /** Alamat penerima bukan email valid. */
  | "INVALID_ADDRESS"
  /** Penerima di luar `EMAIL_ALLOWLIST` (staging). */
  | "NOT_ALLOWLISTED"
  /** Penyedia membatasi laju atau kuota habis. */
  | "RATE_LIMITED"
  /** Kunci/konfigurasi Resend salah (bukan kesalahan pengguna). */
  | "PROVIDER_CONFIG"
  /** Error penyedia lain atau jaringan. */
  | "PROVIDER_ERROR";

export interface EmailErrorOptions {
  /** Nama error Resend (mis. `rate_limit_exceeded`) untuk diagnosis. */
  providerCode?: string | undefined;
  cause?: unknown;
}

/**
 * Error domain `@trush/email`. Pesan tidak memuat alamat penerima, kode
 * OTP, maupun tautan.
 */
export class EmailError extends Error {
  readonly code: EmailErrorCode;
  readonly providerCode: string | undefined;

  constructor(
    code: EmailErrorCode,
    message: string,
    { cause, providerCode }: EmailErrorOptions = {}
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "EmailError";
    this.code = code;
    this.providerCode = providerCode;
  }
}
