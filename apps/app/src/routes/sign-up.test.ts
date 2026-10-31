// @vitest-environment node
// Loader berjalan di Worker; happy-dom memfilter header `cookie`.
import { describe, expect, it } from "vitest";

import {
  appRequest,
  createFakeApi,
  createTestContext,
  jsonResponse,
  ME_FIXTURE,
  SESSION_COOKIE,
  TEST_ENV,
} from "../testing/cloudflare";
import type { ApiHandler } from "../testing/cloudflare";
import { handle, loader } from "./sign-up";

const runLoader = async (path: string, handler: ApiHandler) => {
  const api = createFakeApi(handler);
  const request = appRequest(path, { cookie: SESSION_COOKIE });
  const args: Parameters<typeof loader>[0] = {
    context: createTestContext({ api }),
    params: {},
    pattern: "/sign-up",
    request,
    url: new URL(request.url),
  };
  try {
    return await loader(args);
  } catch (error) {
    return error;
  }
};

describe("route /sign-up", () => {
  it("memuat Turnstile (CSP mengizinkan widget)", () => {
    expect(handle.turnstile).toBeTruthy();
  });

  it("tanpa sesi → data halaman dengan redirectTo tersaring dan site key", async () => {
    const result = await runLoader(
      "/sign-up?redirectTo=%2Fbilling%3Fplan%3Dpro",
      () => new Response(null, { status: 401 })
    );

    expect(result).toStrictEqual({
      redirectTo: "/billing?plan=pro",
      turnstileSiteKey: TEST_ENV.VITE_TURNSTILE_SITE_KEY,
    });
  });

  it("redirectTo eksternal diganti /", async () => {
    const result = await runLoader(
      "/sign-up?redirectTo=https%3A%2F%2Fevil.example",
      () => new Response(null, { status: 401 })
    );

    expect(result).toMatchObject({ redirectTo: "/" });
  });

  it("api gagal → halaman tetap terbuka", async () => {
    const result = await runLoader("/sign-up", () => {
      throw new TypeError("Network connection lost.");
    });

    expect(result).toMatchObject({ redirectTo: "/" });
  });

  it("sudah login → redirect ke redirectTo internal", async () => {
    const result = await runLoader("/sign-up?redirectTo=%2Fsettings", () =>
      jsonResponse(ME_FIXTURE)
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("location")).toBe("/settings");
  });

  it("sudah login dengan redirectTo eksternal → redirect ke /", async () => {
    const result = await runLoader(
      "/sign-up?redirectTo=%2F%2Fevil.example",
      () => jsonResponse(ME_FIXTURE)
    );

    expect((result as Response).headers.get("location")).toBe("/");
  });
});
