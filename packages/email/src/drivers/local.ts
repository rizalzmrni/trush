import { maskEmail } from "../address";
import type { EmailMessage, EmailTransport } from "./types";

/** Email yang ditampung driver `memory`. */
export interface EmailOutboxEntry {
  /** Unik per email (bukan id Resend), agar e2e bisa membedakan kiriman ulang. */
  id: string;
  /** Alamat penerima, huruf kecil. */
  to: string;
  subject: string;
  /** Kode OTP, atau null (mis. email tautan reset password). */
  code: string | null;
  /** Versi teks polos, termasuk tautan utuh. */
  body: string;
  template: string;
  idempotencyKey: string;
  sentAt: Date;
}

const OUTBOX_LIMIT = 50;

/**
 * Kotak keluar driver `memory`, per isolate (variabel modul). Hanya untuk
 * test dan e2e lokal (`/__e2e/outbox`, digabung dengan outbox
 * `@trush/phone`); tidak pernah dipakai di staging/produksi. Keterbatasan
 * sama dengan outbox telepon: hilang saat isolate diganti, 50 email terakhir,
 * e2e paralel wajib menyaring per alamat.
 */
export const createEmailOutbox = () => {
  let entries: EmailOutboxEntry[] = [];
  return {
    add: (message: EmailMessage) => {
      entries.push({
        body: message.text,
        code: message.code,
        id: crypto.randomUUID(),
        idempotencyKey: message.idempotencyKey,
        sentAt: new Date(),
        subject: message.subject,
        template: message.template,
        to: message.to,
      });
      if (entries.length > OUTBOX_LIMIT) {
        entries.shift();
      }
    },
    /** Kosongkan semua, atau hanya email untuk alamat `to` (tanpa beda huruf). */
    clear: (to?: string) => {
      const target = to?.toLowerCase();
      entries =
        target === undefined
          ? []
          : entries.filter((entry) => entry.to !== target);
    },
    /** Salinan, terbaru terakhir. */
    list: (): readonly EmailOutboxEntry[] => [...entries],
    /** Email terakhir untuk alamat tertentu (tanpa beda huruf). */
    latestFor: (to: string): EmailOutboxEntry | undefined => {
      const target = to.toLowerCase();
      return entries.findLast((entry) => entry.to === target);
    },
  };
};

export type EmailOutbox = ReturnType<typeof createEmailOutbox>;

/**
 * Kotak keluar bawaan driver `memory` bila pemanggil tidak memberi sendiri.
 * `@trush/auth` (penulis) dan `/__e2e/outbox` di api (pembaca) berbagi objek
 * ini karena keduanya satu bundel Worker, jadi satu instance modul.
 */
export const defaultEmailOutbox = createEmailOutbox();

export const createMemoryTransport = (outbox: EmailOutbox): EmailTransport => ({
  send: async (message) => {
    outbox.add(message);
    await Promise.resolve();
  },
});

/** Subset logger (LogTape `Logger` cocok) yang dipakai driver `log`. */
export interface EmailLogger {
  info: (message: string, properties?: Record<string, unknown>) => void;
}

/**
 * Driver `log` (development): satu-satunya tempat isi email (kode OTP,
 * tautan reset) boleh ditulis ke log. Alamat tetap disamarkan.
 */
export const createLogTransport = (logger: EmailLogger): EmailTransport => ({
  send: async ({ subject, template, text, to }) => {
    logger.info(
      "Email {template} ke {recipient} (driver log): {subject}\n{text}",
      {
        recipient: maskEmail(to),
        subject,
        template,
        text,
      }
    );
    await Promise.resolve();
  },
});
