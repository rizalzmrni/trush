import { beforeAll, describe, expect, it } from "vitest";

import { BASE_ENV, fetchWorker, requestWithEnv } from "../testing/request";

const WARMUP_TIMEOUT_MS = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const FAKE_CF_RAY = "8f1e2d3c4b5a6978-CGK";

describe("header x-request-id", () => {
  beforeAll(async () => {
    // Pemanasan: request pertama di workerd lambat (transformasi modul Vite).
    await fetchWorker("/health");
  }, WARMUP_TIMEOUT_MS);

  it("UUID bila request tanpa cf-ray", async () => {
    const response = await fetchWorker("/health");

    expect(response.headers.get("x-request-id")).toMatch(UUID);
  });

  it("berbeda di setiap request", async () => {
    const [first, second] = await Promise.all([
      fetchWorker("/health"),
      fetchWorker("/health"),
    ]);

    expect(first.headers.get("x-request-id")).not.toBe(
      second.headers.get("x-request-id")
    );
  });

  it("memakai cf-ray bila ada", async () => {
    const response = await fetchWorker("/health", {
      headers: { "cf-ray": FAKE_CF_RAY },
    });

    expect(response.headers.get("x-request-id")).toBe(FAKE_CF_RAY);
  });

  it.each(["/tidak-ada", "/openapi.json", "/docs"])(
    "ada juga di %s",
    async (path) => {
      const response = await fetchWorker(path);

      expect(response.headers.get("x-request-id")).toMatch(UUID);
    }
  );

  it("ada pada respons 500 (env tidak valid)", async () => {
    const response = await requestWithEnv("/health", {
      ...BASE_ENV,
      CORS_ORIGINS: "bukan-url",
    });

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toMatch(UUID);
  });
});
