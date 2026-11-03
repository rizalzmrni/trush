import type {
  E2eOutboxMessage,
  E2eOutboxResponse,
} from "@trush/core/schemas/e2e";
import { defaultEmailOutbox } from "@trush/email";
import type { EmailOutbox } from "@trush/email";
import { defaultOutbox } from "@trush/phone";
import type { Outbox } from "@trush/phone";

/**
 * Outbox driver `memory` yang dibaca route ini: telepon (`@trush/phone`) dan
 * email (`@trush/email`). Keduanya per isolate: `wrangler dev` lokal
 * menjalankan satu isolate, jadi penulis (`@trush/auth`) dan pembaca (route
 * ini) melihat objek modul yang sama.
 */
export interface Outboxes {
  phone: Outbox;
  email: EmailOutbox;
}

const DEFAULT_OUTBOXES: Outboxes = {
  email: defaultEmailOutbox,
  phone: defaultOutbox,
};

/** Filter `to`: alamat email tanpa beda huruf besar/kecil, nomor persis. */
const matchesRecipient = (recipient: string, to: string | undefined): boolean =>
  to === undefined ||
  (to.includes("@") ? recipient === to.trim().toLowerCase() : recipient === to);

interface TimedMessage {
  message: E2eOutboxMessage;
  sentAt: number;
}

/**
 * Pesan telepon + email dalam bentuk kontrak, terbaru dulu. Urutan antar
 * outbox mengikuti waktu kirim; waktu sama mempertahankan urutan tambah.
 */
export const listOutbox = (
  to: string | undefined,
  outboxes: Outboxes = DEFAULT_OUTBOXES
): E2eOutboxResponse => {
  const phone = outboxes.phone
    .list()
    .map(
      ({ body, channel, code, id, sentAt, to: recipient }): TimedMessage => ({
        message: {
          body,
          channel,
          code,
          createdAt: sentAt.toISOString(),
          id,
          subject: null,
          to: recipient,
        },
        sentAt: sentAt.getTime(),
      })
    );
  const email = outboxes.email
    .list()
    .map(
      ({ body, code, id, sentAt, subject, to: recipient }): TimedMessage => ({
        message: {
          body,
          channel: "email",
          code,
          createdAt: sentAt.toISOString(),
          id,
          subject,
          to: recipient,
        },
        sentAt: sentAt.getTime(),
      })
    );
  // Stabil: dalam tiap outbox urutan tambah dipertahankan (lama → baru).
  const merged = [...phone, ...email].toSorted(
    (left, right) => left.sentAt - right.sentAt
  );
  return {
    messages: merged
      .filter(({ message }) => matchesRecipient(message.to, to))
      .toReversed()
      .map(({ message }) => message),
  };
};

/** Kosongkan kedua outbox, atau hanya pesan untuk `to` (nomor atau email). */
export const clearOutbox = (
  to: string | undefined,
  outboxes: Outboxes = DEFAULT_OUTBOXES
): void => {
  outboxes.phone.clear(to);
  outboxes.email.clear(to);
};
