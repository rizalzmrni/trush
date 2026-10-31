import { z } from "zod";

/**
 * Bentuk error seragam semua response gagal `apps/api` (lihat
 * `docs/hono-api.md`). Status HTTP membawa kategori; `code` membawa alasan
 * yang bisa dicocokkan klien. Tanpa stack trace atau pesan internal.
 */
export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().min(1).meta({ example: "VALIDATION_ERROR" }),
      message: z.string().meta({ example: "Request tidak valid." }),
      details: z.unknown().optional(),
    }),
  })
  .meta({
    description: "Error API standar.",
    id: "ErrorResponse",
  });

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
