import { createRoute } from "@hono/zod-openapi";
import { healthResponseSchema } from "@trush/core/schemas/health";

import { createRouter, errorResponse } from "../openapi";

const HTTP_OK = 200;

const getHealth = createRoute({
  description:
    "Tidak menyentuh DB atau layanan luar; 200 berarti Worker hidup dan env valid.",
  method: "get",
  path: "/health",
  responses: {
    [HTTP_OK]: {
      content: { "application/json": { schema: healthResponseSchema } },
      description: "Worker api sehat.",
    },
    500: errorResponse("Kesalahan internal (mis. env tidak valid)."),
  },
  summary: "Cek kesehatan Worker api",
  tags: ["System"],
});

export const healthRoutes = createRouter().openapi(getHealth, (c) =>
  c.json({ status: "ok" } as const, HTTP_OK)
);
