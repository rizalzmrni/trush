import { describe, expect, it } from "vitest";
import { z } from "zod";

import { healthResponseSchema } from "./health";

describe("skema HealthResponse", () => {
  it("menerima status ok", () => {
    expect(healthResponseSchema.parse({ status: "ok" })).toStrictEqual({
      status: "ok",
    });
  });

  it.each([
    ["status lain", { status: "degraded" }],
    ["status hilang", {}],
    ["bukan objek", "ok"],
  ])("menolak %s", (_label, input) => {
    expect(healthResponseSchema.safeParse(input).success).toBeFalsy();
  });

  it("terdaftar dengan id HealthResponse dan contohnya valid", () => {
    const meta = z.globalRegistry.get(healthResponseSchema);

    expect(meta).toMatchObject({ id: "HealthResponse" });
    expect(healthResponseSchema.safeParse(meta?.example).success).toBeTruthy();
  });
});
