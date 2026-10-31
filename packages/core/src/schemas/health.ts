import { z } from "zod";

/** Response `GET /health` (`apps/api`). */
export const healthResponseSchema = z
  .object({
    status: z.literal("ok"),
  })
  .meta({
    description: "Worker api hidup dan bisa melayani request.",
    example: { status: "ok" },
    id: "HealthResponse",
  });

export type HealthResponse = z.infer<typeof healthResponseSchema>;
