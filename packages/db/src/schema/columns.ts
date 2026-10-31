import { timestamp, uuid } from "drizzle-orm/pg-core";

import { newId } from "../id";

/**
 * Primary key tabel aplikasi: `uuid` berisi UUIDv7 dari `newId()`.
 * Tabel auth (hasil CLI better-auth) tetap ber-id `text`.
 */
export const primaryId = () => uuid("id").primaryKey().$defaultFn(newId);

/** Kolom waktu standar; letakkan di akhir definisi tabel: `...timestamps`. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
