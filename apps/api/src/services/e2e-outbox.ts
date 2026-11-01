import type { E2eOutboxResponse } from "@trush/core/schemas/e2e";
import { defaultOutbox } from "@trush/phone";
import type { Outbox } from "@trush/phone";

/**
 * Pesan driver `memory` `@trush/phone` dalam bentuk kontrak, terbaru dulu.
 * Outbox per isolate: `wrangler dev` lokal menjalankan satu isolate, jadi
 * penulis (`@trush/auth`) dan pembaca (route ini) melihat objek yang sama.
 */
export const listOutbox = (
  to: string | undefined,
  outbox: Outbox = defaultOutbox
): E2eOutboxResponse => ({
  messages: outbox
    .list()
    .filter((entry) => to === undefined || entry.to === to)
    .toReversed()
    .map(({ body, channel, code, id, sentAt, to: recipient }) => ({
      body,
      channel,
      code,
      createdAt: sentAt.toISOString(),
      id,
      to: recipient,
    })),
});

/** Kosongkan outbox, atau hanya pesan untuk `to`. */
export const clearOutbox = (
  to: string | undefined,
  outbox: Outbox = defaultOutbox
): void => {
  outbox.clear(to);
};
