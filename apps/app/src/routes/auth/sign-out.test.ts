import { describe, expect, it } from "vitest";

import { loader } from "./sign-out";

describe("route /sign-out", () => {
  it("GET tidak mengakhiri sesi, hanya mengarahkan ke /sign-in", () => {
    const response = loader();

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/sign-in");
    expect(response.headers.has("set-cookie")).toBeFalsy();
  });
});
