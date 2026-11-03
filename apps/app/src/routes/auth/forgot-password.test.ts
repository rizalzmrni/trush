import { describe, expect, it } from "vitest";

import {
  appRequest,
  createTestContext,
  TEST_ENV,
  unusedApi,
} from "../../testing/cloudflare";
import { handle, loader } from "./forgot-password";

const runLoader = (path: string) => {
  const request = appRequest(path);
  const args: Parameters<typeof loader>[0] = {
    context: createTestContext({ api: unusedApi() }),
    params: {},
    pattern: "/forgot-password",
    request,
    url: new URL(request.url),
  };
  return loader(args);
};

describe("route /forgot-password", () => {
  it("memuat Turnstile", () => {
    expect(handle.turnstile).toBeTruthy();
  });

  it("site key + redirectTo tersaring, tanpa memanggil api", () => {
    expect(
      runLoader("/forgot-password?redirectTo=https%3A%2F%2Fevil.example")
    ).toStrictEqual({
      redirectTo: "/",
      turnstileSiteKey: TEST_ENV.VITE_TURNSTILE_SITE_KEY,
    });
  });
});
