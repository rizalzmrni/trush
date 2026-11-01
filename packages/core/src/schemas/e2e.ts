import { z } from "zod";

const EXAMPLE_DATE = "2026-11-01T09:00:00.000Z";
const EXAMPLE_PHONE = "+6281234567890";

/** Waktu ISO 8601 UTC, mis. `2026-11-01T09:00:00.000Z`. */
const isoDateTimeSchema = z.iso.datetime();

/**
 * Kanal pesan outbox. Telepon saat ini; `email` ditambahkan bersama driver
 * `memory` `@trush/email` (penambahan nilai, bukan perubahan bentuk).
 */
export const e2eOutboxChannelSchema = z.enum(["whatsapp", "sms"]);

/** Satu pesan yang "dikirim" driver `memory` (tidak pernah ke penyedia nyata). */
export const e2eOutboxMessageSchema = z
  .object({
    /** Unik per pesan; kiriman ulang ke nomor sama punya id berbeda. */
    id: z.string().min(1),
    channel: e2eOutboxChannelSchema,
    /** Tujuan: nomor E.164 untuk telepon (alamat email nanti). */
    to: z.string().min(1),
    /** Kode OTP; null untuk pesan tanpa kode (mis. email tautan, nanti). */
    code: z.string().nullable(),
    /** Isi teks pesan (SMS; WhatsApp memakai template setara). */
    body: z.string(),
    createdAt: isoDateTimeSchema,
  })
  .meta({ id: "E2eOutboxMessage" });

/**
 * Response `GET /__e2e/outbox` (`apps/api`, hanya `E2E=true` di development).
 * Urut terbaru dulu: `messages[0]` adalah pesan terakhir.
 */
export const e2eOutboxResponseSchema = z
  .object({
    messages: z.array(e2eOutboxMessageSchema),
  })
  .meta({
    description: "Pesan driver memory, terbaru dulu.",
    example: {
      messages: [
        {
          body: "Kode verifikasi trush: 482913. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.",
          channel: "whatsapp",
          code: "482913",
          createdAt: EXAMPLE_DATE,
          id: "5f0c6f5e-8d0a-4c49-9a43-1f0c8f6b2a11",
          to: EXAMPLE_PHONE,
        },
      ],
    },
    id: "E2eOutboxResponse",
  });

/** Query `GET`/`DELETE /__e2e/outbox`: `to` menyaring satu tujuan. */
export const e2eOutboxQuerySchema = z.object({
  to: z
    .string()
    .min(1)
    .optional()
    .meta({ description: "Tujuan persis (E.164), mis. +6281234567890." }),
});

export type E2eOutboxChannel = z.infer<typeof e2eOutboxChannelSchema>;
export type E2eOutboxMessage = z.infer<typeof e2eOutboxMessageSchema>;
export type E2eOutboxResponse = z.infer<typeof e2eOutboxResponseSchema>;
export type E2eOutboxQuery = z.infer<typeof e2eOutboxQuerySchema>;
