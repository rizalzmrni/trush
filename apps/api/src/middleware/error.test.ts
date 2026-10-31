import { errorResponseSchema } from "@trush/core/schemas/error";
import { beforeAll, describe, expect, it } from "vitest";

import { BASE_ENV, fetchWorker, requestWithEnv } from "../testing/request";

const WARMUP_TIMEOUT_MS = 30_000;

describe("route tak dikenal", () => {
  beforeAll(async () => {
    // Pemanasan: request pertama di workerd lambat (transformasi modul Vite).
    await fetchWorker("/health");
  }, WARMUP_TIMEOUT_MS);

  it.each(["/tidak-ada", "/api/tidak-ada", "/health/extra"])(
    "%s → 404 ErrorResponse NOT_FOUND",
    async (path) => {
      const response = await fetchWorker(path);

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toMatch(
        /^application\/json/u
      );

      const body: unknown = await response.json();

      expect(errorResponseSchema.safeParse(body).success).toBeTruthy();
      expect(body).toMatchObject({ error: { code: "NOT_FOUND" } });
    }
  );
});

describe("error tak tertangani (env tidak valid)", () => {
  // CORS_ORIGINS bukan URL: createApiEnv melempar di middleware.
  const invalidEnv = { ...BASE_ENV, CORS_ORIGINS: "bukan-url" };

  it("500 ErrorResponse INTERNAL_ERROR", async () => {
    const response = await requestWithEnv("/health", invalidEnv);

    expect(response.status).toBe(500);

    const body: unknown = await response.json();

    expect(errorResponseSchema.safeParse(body).success).toBeTruthy();
    expect(body).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  it("tidak membocorkan stack trace, nama env, atau nilai env", async () => {
    const response = await requestWithEnv("/health", invalidEnv);
    const text = await response.text();

    expect(text).not.toContain("CORS_ORIGINS");
    expect(text).not.toContain("bukan-url");
    expect(text).not.toMatch(/\bat\s.+:\d+:\d+/u);
    expect(text).not.toContain("stack");
    expect(JSON.parse(text)).not.toHaveProperty("error.details");
  });

  it("env wajib hilang (APP_ENV) juga 500 ErrorResponse", async () => {
    const { APP_ENV: _omitted, ...withoutAppEnv } = BASE_ENV;
    const response = await requestWithEnv("/health", withoutAppEnv);

    expect(response.status).toBe(500);
    expect(
      errorResponseSchema.safeParse(await response.json()).success
    ).toBeTruthy();
  });

  it("header keamanan tetap terpasang pada respons error", async () => {
    const response = await requestWithEnv("/health", invalidEnv);

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'"
    );
  });
});
