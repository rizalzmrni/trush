import { z } from "zod";

const EXAMPLE_DATE = "2026-11-01T09:00:00.000Z";
const EXAMPLE_PHONE = "+6281234567890";
const EXAMPLE_EMAIL = "budi@example.com";

/** Waktu ISO 8601 UTC, mis. `2026-11-01T09:00:00.000Z`. */
const isoDateTimeSchema = z.iso.datetime();

/**
 * Kanal pesan outbox: `whatsapp`/`sms` dari driver `memory` `@trush/phone`,
 * `email` dari driver `memory` `@trush/email`.
 */
export const e2eOutboxChannelSchema = z.enum(["whatsapp", "sms", "email"]);

/** Satu pesan yang "dikirim" driver `memory` (tidak pernah ke penyedia nyata). */
export const e2eOutboxMessageSchema = z
  .object({
    /** Unik per pesan; kiriman ulang ke tujuan sama punya id berbeda. */
    id: z.string().min(1),
    channel: e2eOutboxChannelSchema,
    /** Tujuan: nomor E.164 (telepon) atau alamat email huruf kecil (email). */
    to: z.string().min(1),
    /** Subjek email; selalu null untuk telepon. */
    subject: z.string().nullable(),
    /** Kode OTP; null untuk pesan tanpa kode (mis. email tautan reset password). */
    code: z.string().nullable(),
    /**
     * Isi teks: SMS (WhatsApp memakai template setara) atau versi teks polos
     * email, termasuk tautan utuh (mis. tautan reset password).
     */
    body: z.string(),
    createdAt: isoDateTimeSchema,
  })
  .meta({ id: "E2eOutboxMessage" });

/**
 * Response `GET /__e2e/outbox` (`apps/api`, hanya `E2E=true` di development).
 * Urut terbaru dulu: `messages[0]` adalah pesan terakhir, telepon dan email
 * digabung dalam satu daftar.
 */
export const e2eOutboxResponseSchema = z
  .object({
    messages: z.array(e2eOutboxMessageSchema),
  })
  .meta({
    description: "Pesan driver memory (telepon + email), terbaru dulu.",
    example: {
      messages: [
        {
          body: "Kode verifikasi email trush: 731508. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.",
          channel: "email",
          code: "731508",
          createdAt: EXAMPLE_DATE,
          id: "0b6f1d2e-3c4a-4e5f-8a9b-7c6d5e4f3a21",
          subject: "Kode verifikasi email trush",
          to: EXAMPLE_EMAIL,
        },
        {
          body: "Kode verifikasi trush: 482913. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.",
          channel: "whatsapp",
          code: "482913",
          createdAt: EXAMPLE_DATE,
          id: "5f0c6f5e-8d0a-4c49-9a43-1f0c8f6b2a11",
          subject: null,
          to: EXAMPLE_PHONE,
        },
      ],
    },
    id: "E2eOutboxResponse",
  });

/** Query `GET`/`DELETE /__e2e/outbox`: `to` menyaring satu tujuan. */
export const e2eOutboxQuerySchema = z.object({
  to: z.string().min(1).optional().meta({
    description:
      "Tujuan persis: nomor E.164 (mis. +6281234567890) atau alamat email (dibandingkan tanpa beda huruf besar/kecil).",
  }),
});

export type E2eOutboxChannel = z.infer<typeof e2eOutboxChannelSchema>;
export type E2eOutboxMessage = z.infer<typeof e2eOutboxMessageSchema>;
export type E2eOutboxResponse = z.infer<typeof e2eOutboxResponseSchema>;
export type E2eOutboxQuery = z.infer<typeof e2eOutboxQuerySchema>;
