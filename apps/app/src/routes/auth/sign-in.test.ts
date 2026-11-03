import { describe, expect, it } from "vitest";

import {
  appRequest,
  createFakeApi,
  createTestContext,
  jsonResponse,
  ME_FIXTURE,
  SESSION_COOKIE,
  TEST_ENV,
} from "../../testing/cloudflare";
import type { ApiHandler } from "../../testing/cloudflare";
import { handle, loader } from "./sign-in";

const runLoader = async (path: string, handler: ApiHandler) => {
  const api = createFakeApi(handler);
  const request = appRequest(path, { cookie: SESSION_COOKIE });
  const args: Parameters<typeof loader>[0] = {
    context: createTestContext({ api }),
    params: {},
    pattern: "/sign-in",
    request,
    url: new URL(request.url),
  };
  try {
    return await loader(args);
  } catch (error) {
    return error;
  }
};

describe("route /sign-in", () => {
  it("memuat Turnstile (CSP mengizinkan widget)", () => {
    expect(handle.turnstile).toBeTruthy();
  });

  it("tanpa sesi → data halaman dengan redirectTo tersaring dan site key", async () => {
    const result = await runLoader(
      "/sign-in?redirectTo=%2Fbilling%3Fplan%3Dpro",
      () => new Response(null, { status: 401 })
    );

    expect(result).toStrictEqual({
      redirectTo: "/billing?plan=pro",
      turnstileSiteKey: TEST_ENV.VITE_TURNSTILE_SITE_KEY,
    });
  });

  it("redirectTo eksternal diganti /", async () => {
    const result = await runLoader(
      "/sign-in?redirectTo=https%3A%2F%2Fevil.example",
      () => new Response(null, { status: 401 })
    );

    expect(result).toMatchObject({ redirectTo: "/" });
  });

  it("api gagal → halaman tetap terbuka", async () => {
    const result = await runLoader("/sign-in", () => {
      throw new TypeError("Network connection lost.");
    });

    expect(result).toMatchObject({ redirectTo: "/" });
  });

  it("sudah login → redirect ke redirectTo internal", async () => {
    const result = await runLoader("/sign-in?redirectTo=%2Fsettings", () =>
      jsonResponse(ME_FIXTURE)
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("location")).toBe("/settings");
  });

  it("sudah login dengan redirectTo eksternal → redirect ke /", async () => {
    const result = await runLoader(
      "/sign-in?redirectTo=%2F%2Fevil.example",
      () => jsonResponse(ME_FIXTURE)
    );

    expect((result as Response).headers.get("location")).toBe("/");
  });

  it.each([
    "%2F.%2F%2Fevil.example",
    "%2Fa%2F..%2F%2Fevil.example",
    "%2F%252e%2F%2Fevil.example",
  ])(
    "sudah login dengan redirectTo dot-segment %s → redirect ke /",
    async (encoded) => {
      const result = await runLoader(`/sign-in?redirectTo=${encoded}`, () =>
        jsonResponse(ME_FIXTURE)
      );

      expect((result as Response).headers.get("location")).toBe("/");
    }
  );

  it("sudah login dengan redirectTo /sign-in/ → redirect ke /", async () => {
    const result = await runLoader("/sign-in?redirectTo=%2Fsign-in%2F", () =>
      jsonResponse(ME_FIXTURE)
    );

    expect((result as Response).headers.get("location")).toBe("/");
  });

  it("?notice dikenal + ?email valid → pesan sukses dan email awal (dinormalisasi)", async () => {
    const result = await runLoader(
      "/sign-in?notice=email-verified&email=%20Budi%40Example.TEST%20",
      () => new Response(null, { status: 401 })
    );

    expect(result).toStrictEqual({
      email: "budi@example.test",
      notice: expect.stringContaining("Email berhasil diverifikasi"),
      redirectTo: "/",
      turnstileSiteKey: TEST_ENV.VITE_TURNSTILE_SITE_KEY,
    });
  });

  it("?notice=password-reset → pesan kata sandi diganti", async () => {
    const result = await runLoader(
      "/sign-in?notice=password-reset",
      () => new Response(null, { status: 401 })
    );

    expect(result).toMatchObject({
      notice: expect.stringContaining("Kata sandi berhasil diganti"),
    });
  });

  it("?notice asing dan ?email tidak valid tidak ikut ke halaman", async () => {
    const result = await runLoader(
      "/sign-in?notice=Akun%20diblokir&email=%3Cscript%3E",
      () => new Response(null, { status: 401 })
    );

    expect(result).not.toHaveProperty("notice");
    expect(result).not.toHaveProperty("email");
  });
});
