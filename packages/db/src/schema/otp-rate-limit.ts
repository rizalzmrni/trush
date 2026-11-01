import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { primaryId } from "./columns";

/**
 * Penghitung jendela tetap untuk permintaan OTP per pengguna dan per nomor
 * tujuan (`@trush/auth`, B7c). Terpisah dari `rate_limit` better-auth, yang
 * hanya per IP + path dan memangkas baris lebih tua dari jendela terpanjang
 * aturannya sendiri (60 detik), sehingga hitungan per jam akan terhapus.
 */
export const otpRateLimit = pgTable(
  "otp_rate_limit",
  {
    id: primaryId(),
    /** Mis. `otp:phone:+6281234567890` atau `otp:user:<id>`. */
    key: text("key").notNull().unique(),
    count: integer("count").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  },
  (table) => [index("otp_rate_limit_window_start_idx").on(table.windowStart)]
);
