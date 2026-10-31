import { OpenAPIHono } from "@hono/zod-openapi";
import { errorResponseSchema } from "@trush/core/schemas/error";
import type { ErrorResponse } from "@trush/core/schemas/error";

import type { AppContext } from "./context";

const HTTP_BAD_REQUEST = 400;

/**
 * Router `OpenAPIHono` trush. Semua route dibuat lewat factory ini agar error
 * validasi selalu berbentuk `ErrorResponse` (400) di mana pun dipasang.
 */
export const createRouter = () =>
  new OpenAPIHono<AppContext>({
    defaultHook: (result, c) => {
      if (result.success) {
        return;
      }
      const body: ErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          details: result.error.issues.map(({ code, message, path }) => ({
            code,
            message,
            path,
          })),
          message: "Request tidak valid.",
        },
      };
      return c.json(body, HTTP_BAD_REQUEST);
    },
  });

/** Respons error untuk `responses` di `createRoute`. */
export const errorResponse = (description: string) => ({
  content: { "application/json": { schema: errorResponseSchema } },
  description,
});

export const OPENAPI_PATH = "/openapi.json";
export const DOCS_PATH = "/docs";

export const OPENAPI_DOCUMENT = {
  info: {
    description: "API trush. Semua error berbentuk `ErrorResponse`.",
    title: "trush API",
    version: "0.0.0",
  },
  openapi: "3.1.0",
} as const;
