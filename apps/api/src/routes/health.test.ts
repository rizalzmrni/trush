import { healthResponseSchema } from "@trush/core/schemas/health";
import { beforeAll, describe, expect, it } from "vitest";

import { fetchWorker } from "../testing/request";

const WARMUP_TIMEOUT_MS = 30_000;

describe("GET /health", () => {
  beforeAll(async () => {
    // Pemanasan: request pertama di workerd lambat (transformasi modul Vite).
    await fetchWorker("/health");
  }, WARMUP_TIMEOUT_MS);

  it("200 dengan body HealthResponse yang valid", async () => {
    const response = await fetchWorker("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^application\/json/u);

    const body: unknown = await response.json();

    expect(healthResponseSchema.safeParse(body).success).toBeTruthy();
    expect(body).toStrictEqual({ status: "ok" });
  });

  it("method selain GET tidak dilayani dan error berbentuk ErrorResponse", async () => {
    const response = await fetchWorker("/health", { method: "POST" });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });
});
