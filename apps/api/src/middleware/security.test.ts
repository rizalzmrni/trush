import { beforeAll, describe, expect, it } from "vitest";

import {
  ALLOWED_ORIGIN,
  BASE_ENV,
  fetchWorker,
  requestWithEnv,
} from "../testing/request";

const WARMUP_TIMEOUT_MS = 30_000;
const HSTS_VALUE = "max-age=31536000; includeSubDomains";

const PRODUCTION_ENV = {
  ...BASE_ENV,
  APP_ENV: "production",
  CORS_ORIGINS: "https://app.example.com,https://example.com",
};

describe("header keamanan respons JSON", () => {
  beforeAll(async () => {
    // Pemanasan: request pertama di workerd lambat (transformasi modul Vite).
    await fetchWorker("/health");
  }, WARMUP_TIMEOUT_MS);

  it.each(["/health", "/openapi.json", "/tidak-ada"])("%s", async (path) => {
    const response = await fetchWorker(path);
    const { headers } = response;

    expect(headers.get("content-security-policy")).toBe(
      "default-src 'none'; frame-ancestors 'none'"
    );
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(headers.get("x-frame-options")).toBe("DENY");
  });
});

describe("HSTS", () => {
  it("tidak ada di development", async () => {
    const response = await fetchWorker("/health");

    expect(response.headers.get("strict-transport-security")).toBeNull();
  });

  it("ada di production pada domain resmi", async () => {
    const response = await requestWithEnv(
      "https://api.example.com/health",
      PRODUCTION_ENV
    );

    expect(response.headers.get("strict-transport-security")).toBe(HSTS_VALUE);
  });

  it.each([
    "https://trush-api-production.example.workers.dev/health",
    "http://localhost:8787/health",
    "http://127.0.0.1:8787/health",
  ])("tidak ada di production pada host bukan resmi: %s", async (url) => {
    const response = await requestWithEnv(url, PRODUCTION_ENV);

    expect(response.headers.get("strict-transport-security")).toBeNull();
  });

  it.each(["staging", "development"])(
    "tidak ada di %s meski domain resmi",
    async (appEnv) => {
      const response = await requestWithEnv("https://api.example.com/health", {
        ...PRODUCTION_ENV,
        APP_ENV: appEnv,
      });

      expect(response.headers.get("strict-transport-security")).toBeNull();
    }
  );
});

describe("CORS", () => {
  it("origin terdaftar dipantulkan dengan credentials, tidak pernah *", async () => {
    const response = await fetchWorker("/health", {
      headers: { origin: ALLOWED_ORIGIN },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe(
      ALLOWED_ORIGIN
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true"
    );
  });

  it("origin kedua di daftar juga diterima", async () => {
    const response = await fetchWorker("/health", {
      headers: { origin: "http://localhost:5174" },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5174"
    );
  });

  it.each([
    "https://evil.example.test",
    "http://localhost:5173.evil.example.test",
    "null",
  ])("origin asing %s tidak mendapat allow-origin", async (origin) => {
    const response = await fetchWorker("/health", { headers: { origin } });
    const allowOrigin = response.headers.get("access-control-allow-origin");

    expect(allowOrigin === null || allowOrigin === "").toBeTruthy();
    expect(allowOrigin).not.toBe("*");
  });

  it("preflight dari origin terdaftar dijawab dengan credentials", async () => {
    const response = await fetchWorker("/health", {
      headers: {
        "access-control-request-method": "GET",
        origin: ALLOWED_ORIGIN,
      },
      method: "OPTIONS",
    });

    expect(response.status).toBeLessThan(300);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      ALLOWED_ORIGIN
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true"
    );
  });

  it("preflight dari origin asing tidak mendapat allow-origin", async () => {
    const response = await fetchWorker("/health", {
      headers: {
        "access-control-request-method": "GET",
        origin: "https://evil.example.test",
      },
      method: "OPTIONS",
    });
    const allowOrigin = response.headers.get("access-control-allow-origin");

    expect(allowOrigin === null || allowOrigin === "").toBeTruthy();
  });
});
