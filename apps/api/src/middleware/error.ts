import type { ErrorResponse } from "@trush/core/schemas/error";
import { getLogger } from "@trush/observability/logger";
import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { AppContext } from "../context";

const logger = getLogger(["trush", "api"]);

const HTTP_INTERNAL_SERVER_ERROR = 500;
const HTTP_NOT_FOUND = 404;

/** Kode default per status untuk `HTTPException` tanpa kode eksplisit. */
const CODE_BY_STATUS: Readonly<Partial<Record<number, string>>> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE_ENTITY",
  429: "RATE_LIMITED",
};

const errorJson = (
  c: Context<AppContext>,
  status: ContentfulStatusCode,
  code: string,
  message: string
) => {
  const body: ErrorResponse = { error: { code, message } };
  return c.json(body, status);
};

/**
 * Satu-satunya penangan error global. `HTTPException` (dilempar route atau
 * middleware Hono) diteruskan dengan statusnya; selain itu 500 tanpa pesan
 * internal atau stack trace. Detail hanya ke log (sudah diredaksi).
 */
export const onError: ErrorHandler<AppContext> = (error, c) => {
  if (
    error instanceof HTTPException &&
    error.status < HTTP_INTERNAL_SERVER_ERROR
  ) {
    const status = error.status as ContentfulStatusCode;
    return errorJson(
      c,
      status,
      CODE_BY_STATUS[status] ?? "HTTP_ERROR",
      error.message || "Request tidak dapat diproses."
    );
  }
  logger.error("Error tak tertangani pada {method} {path}.", {
    error,
    method: c.req.method,
    path: c.req.path,
  });
  return errorJson(
    c,
    HTTP_INTERNAL_SERVER_ERROR,
    "INTERNAL_ERROR",
    "Terjadi kesalahan pada server."
  );
};

export const notFound: NotFoundHandler<AppContext> = (c) =>
  errorJson(c, HTTP_NOT_FOUND, "NOT_FOUND", "Route tidak ditemukan.");
