import { errorResponseSchema } from "@trush/core/schemas/error";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ALLOWED_ORIGIN,
  envForAppEnv,
  fetchWorker,
  requestWithEnv,
} from "../testing/request";

const WARMUP_TIMEOUT_MS = 30_000;
const SESSION_COOKIE = "__Secure-better-auth.session_token";
const ME_PATHS = ["/api/me", "/api/me/organizations"] as const;
const AUTH_SCHEMA_PATH = "/api/auth/open-api/generate-schema";

const operationSchema = z.looseObject({
  responses: z.record(z.string(), z.unknown()),
  security: z.array(z.record(z.string(), z.array(z.string()))).optional(),
});

const openApiSchema = z.looseObject({
  components: z.looseObject({
    securitySchemes: z.record(z.string(), z.unknown()),
  }),
  paths: z.record(z.string(), z.record(z.string(), operationSchema)),
});

describe("route /api/me tanpa sesi", () => {
  beforeAll(async () => {
    // Pemanasan: request pertama di workerd lambat (transformasi modul Vite).
    await fetchWorker("/health");
  }, WARMUP_TIMEOUT_MS);

  it.each(ME_PATHS)(
    "%s tanpa cookie → 401 ErrorResponse UNAUTHORIZED",
    async (path) => {
      const response = await fetchWorker(path, {
        headers: { origin: ALLOWED_ORIGIN },
      });
      const body: unknown = await response.json();

      expect(response.status).toBe(401);
      expect(errorResponseSchema.safeParse(body).success).toBeTruthy();
      expect(body).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    }
  );

  it.each(ME_PATHS)(
    "%s 401 tetap membawa header CORS credentials",
    async (path) => {
      const response = await fetchWorker(path, {
        headers: { origin: ALLOWED_ORIGIN },
      });

      expect(response.status).toBe(401);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        ALLOWED_ORIGIN
      );
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true"
      );
    }
  );

  it.each(ME_PATHS)(
    "%s dengan cookie sesi berformat salah → 401",
    async (path) => {
      const response = await fetchWorker(path, {
        headers: { cookie: `${SESSION_COOKIE}=bukan-token-yang-sah` },
      });

      expect(response.status).toBe(401);
    }
  );

  it("method selain GET pada /api/me tidak dilayani", async () => {
    const response = await fetchWorker("/api/me", { method: "POST" });

    expect(response.status).toBe(404);
  });
});

const preflight = (origin: string) =>
  fetchWorker("/api/auth/sign-in/email", {
    headers: {
      "access-control-request-headers": "content-type,x-captcha-response",
      "access-control-request-method": "POST",
      origin,
    },
    method: "OPTIONS",
  });

describe("preflight /api/auth/sign-in/email", () => {
  it("origin terdaftar dijawab dengan credentials", async () => {
    const response = await preflight(ALLOWED_ORIGIN);

    expect(response.status).toBeLessThan(300);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      ALLOWED_ORIGIN
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true"
    );
  });

  it("origin asing tidak mendapat allow-origin", async () => {
    const response = await preflight("https://evil.example.test");
    const allowOrigin = response.headers.get("access-control-allow-origin");

    expect(allowOrigin === null || allowOrigin === "").toBeTruthy();
  });
});

describe("skema OpenAPI better-auth", () => {
  it("404 ErrorResponse saat production tanpa API_DOCS_ENABLED", async () => {
    const response = await requestWithEnv(AUTH_SCHEMA_PATH, {
      ...envForAppEnv("production"),
      API_DOCS_ENABLED: "false",
    });
    const body: unknown = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("404 saat staging tanpa API_DOCS_ENABLED", async () => {
    const response = await requestWithEnv(AUTH_SCHEMA_PATH, {
      ...envForAppEnv("staging"),
      API_DOCS_ENABLED: "false",
    });

    expect(response.status).toBe(404);
  });

  it("200 di development", async () => {
    const response = await fetchWorker(AUTH_SCHEMA_PATH);

    expect(response.status).toBe(200);
  });
});

describe("dokumen /openapi.json untuk /api/me", () => {
  it.each(ME_PATHS)(
    "%s memakai security sessionCookie dan respons 401",
    async (path) => {
      const response = await fetchWorker("/openapi.json");
      const document = openApiSchema.parse(await response.json());
      const operation = document.paths[path]?.get;

      expect(operation?.security).toStrictEqual([{ sessionCookie: [] }]);
      expect(Object.keys(operation?.responses ?? {})).toStrictEqual(
        expect.arrayContaining(["200", "401"])
      );
    }
  );

  it("security scheme sessionCookie menunjuk cookie __Secure-", async () => {
    const response = await fetchWorker("/openapi.json");
    const document = openApiSchema.parse(await response.json());

    expect(document.components.securitySchemes.sessionCookie).toStrictEqual({
      description: expect.any(String),
      in: "cookie",
      name: SESSION_COOKIE,
      type: "apiKey",
    });
  });
});
