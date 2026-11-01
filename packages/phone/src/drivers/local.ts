import { maskPhone } from "../number";
import { smsOtpBody } from "./twilio";
import type { OtpMessage, PhoneTransport } from "./types";

/** Pesan yang ditampung driver `memory`. */
export interface OutboxEntry extends OtpMessage {
  /** Unik per pesan (bukan id DB), agar e2e bisa membedakan kiriman ulang. */
  id: string;
  /** Teks SMS untuk kode ini (WhatsApp memakai template, isinya setara). */
  body: string;
  sentAt: Date;
}

const OUTBOX_LIMIT = 50;

/**
 * Kotak keluar driver `memory`, per isolate (variabel modul, bukan storage
 * bersama). Hanya untuk test dan e2e lokal (`/__e2e/outbox`); tidak pernah
 * dipakai di staging/produksi. Keterbatasan: isi hilang saat isolate diganti
 * (reload `wrangler dev`, eviction), tidak terlihat dari isolate lain, dan
 * hanya menyimpan 50 pesan terakhir; e2e paralel wajib menyaring per nomor.
 */
export const createOutbox = () => {
  let entries: OutboxEntry[] = [];
  return {
    add: (message: OtpMessage) => {
      entries.push({
        ...message,
        body: smsOtpBody(message.code),
        id: crypto.randomUUID(),
        sentAt: new Date(),
      });
      if (entries.length > OUTBOX_LIMIT) {
        entries.shift();
      }
    },
    /** Kosongkan semua, atau hanya pesan untuk nomor E.164 `to`. */
    clear: (to?: string) => {
      entries =
        to === undefined ? [] : entries.filter((entry) => entry.to !== to);
    },
    /** Salinan, terbaru terakhir. */
    list: (): readonly OutboxEntry[] => [...entries],
    /** Pesan terakhir untuk nomor E.164 tertentu. */
    latestFor: (to: string): OutboxEntry | undefined =>
      entries.findLast((entry) => entry.to === to),
  };
};

export type Outbox = ReturnType<typeof createOutbox>;

/**
 * Kotak keluar bawaan driver `memory` bila pemanggil tidak memberi sendiri.
 * `@trush/auth` (penulis) dan `/__e2e/outbox` di api (pembaca) berbagi objek
 * ini karena keduanya satu bundel Worker, jadi satu instance modul.
 */
export const defaultOutbox = createOutbox();

export const createMemoryTransport = (outbox: Outbox): PhoneTransport => ({
  send: async (message) => {
    outbox.add(message);
    await Promise.resolve();
  },
});

/** Subset logger (LogTape `Logger` cocok) yang dipakai driver `log`. */
export interface PhoneLogger {
  info: (message: string, properties?: Record<string, unknown>) => void;
}

/**
 * Driver `log` (development): satu-satunya tempat kode OTP boleh ditulis ke
 * log. Nomor tetap disamarkan.
 */
export const createLogTransport = (logger: PhoneLogger): PhoneTransport => ({
  send: async ({ channel, code, to }) => {
    logger.info("OTP {otp} via {channel} ke {recipient} (driver log).", {
      channel,
      otp: code,
      recipient: maskPhone(to),
    });
    await Promise.resolve();
  },
});
