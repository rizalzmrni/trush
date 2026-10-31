import { createRoute } from "@hono/zod-openapi";
import { requireSession } from "@trush/auth";
import {
  meOrganizationsResponseSchema,
  meResponseSchema,
} from "@trush/core/schemas/me";

import { createRouter, errorResponse, SESSION_SECURITY } from "../openapi";
import { listUserOrganizations, toMeResponse } from "../services/me";

const HTTP_OK = 200;

const getMe = createRoute({
  description: "Sumber auth gate frontend. 401 bila cookie sesi tidak valid.",
  method: "get",
  middleware: [requireSession] as const,
  path: "/api/me",
  responses: {
    [HTTP_OK]: {
      content: { "application/json": { schema: meResponseSchema } },
      description: "Pengguna dan sesi aktif.",
    },
    401: errorResponse("Tidak ada sesi atau sesi kedaluwarsa."),
    500: errorResponse("Kesalahan internal."),
  },
  security: SESSION_SECURITY,
  summary: "Pengguna yang sedang login",
  tags: ["Me"],
});

const getMyOrganizations = createRoute({
  description:
    "Organisasi tempat pengguna menjadi anggota; organisasi aktif dipilih app lewat `:slug` URL.",
  method: "get",
  middleware: [requireSession] as const,
  path: "/api/me/organizations",
  responses: {
    [HTTP_OK]: {
      content: {
        "application/json": { schema: meOrganizationsResponseSchema },
      },
      description: "Daftar organisasi pengguna, urut nama.",
    },
    401: errorResponse("Tidak ada sesi atau sesi kedaluwarsa."),
    500: errorResponse("Kesalahan internal."),
  },
  security: SESSION_SECURITY,
  summary: "Organisasi pengguna yang sedang login",
  tags: ["Me"],
});

export const meRoutes = createRouter()
  .openapi(getMe, (c) => c.json(toMeResponse(c.var.authSession), HTTP_OK))
  .openapi(getMyOrganizations, async (c) =>
    c.json(
      await listUserOrganizations(c.var.db, c.var.authSession.user.id),
      HTTP_OK
    )
  );
