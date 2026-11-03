/** Email yang sudah dirender dan lolos guard penerima. */
export interface EmailMessage {
  /** Alamat penerima, huruf kecil. */
  to: string;
  subject: string;
  html: string;
  /** Versi teks polos (juga isi outbox `memory` dan driver `log`). */
  text: string;
  /** Kode OTP bila ada; hanya untuk outbox e2e dan driver `log`. */
  code: string | null;
  /**
   * Kunci idempotensi Resend (mis. `password-reset/<userId>/<tokenId>`);
   * pengiriman ulang dengan kunci sama dalam 24 jam tidak menggandakan email.
   */
  idempotencyKey: string;
  /** Nama template, untuk tag Resend dan log. */
  template: string;
}

/** Satu driver pengirim; melempar `EmailError` bila gagal. */
export interface EmailTransport {
  send: (message: EmailMessage) => Promise<void>;
}
