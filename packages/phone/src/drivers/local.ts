import { maskPhone } from "../number";
import type { OtpMessage, PhoneTransport } from "./types";

/** Pesan yang ditampung driver `memory`. */
export interface OutboxEntry extends OtpMessage {
  sentAt: Date;
}

const OUTBOX_LIMIT = 50;

/**
 * Kotak keluar driver `memory`, per isolate. Hanya untuk test dan e2e lokal
 * (`/__e2e/outbox`, B8); tidak pernah dipakai di staging/produksi.
 */
export const createOutbox = () => {
  const entries: OutboxEntry[] = [];
  return {
    add: (message: OtpMessage) => {
      entries.push({ ...message, sentAt: new Date() });
      if (entries.length > OUTBOX_LIMIT) {
        entries.shift();
      }
    },
    clear: () => {
      entries.length = 0;
    },
    /** Salinan, terbaru terakhir. */
    list: (): readonly OutboxEntry[] => [...entries],
    /** Pesan terakhir untuk nomor E.164 tertentu. */
    latestFor: (to: string): OutboxEntry | undefined =>
      entries.findLast((entry) => entry.to === to),
  };
};

export type Outbox = ReturnType<typeof createOutbox>;

/** Kotak keluar bawaan driver `memory` bila pemanggil tidak memberi sendiri. */
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
