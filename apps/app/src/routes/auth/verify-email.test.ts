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
import { handle, loader } from "./verify-email";

const anonymous: ApiHandler = () => new Response(null, { status: 401 });

const runLoader = async (path: string, handler: ApiHandler = anonymous) => {
  const api = createFakeApi(handler);
  const request = appRequest(path, { cookie: SESSION_COOKIE });
  const args: Parameters<typeof loader>[0] = {
    context: createTestContext({ api }),
    params: {},
    pattern: "/verify-email",
    request,
    url: new URL(request.url),
  };
  try {
    return await loader(args);
  } catch (error) {
    return error;
  }
};

describe("route /verify-email", () => {
  it("memuat Turnstile (kirim ulang kode)", () => {
    expect(handle.turnstile).toBeTruthy();
  });

  it("tanpa sesi → email dinormalisasi, pesan sesuai reason, redirectTo tersaring", async () => {
    const result = await runLoader(
      "/verify-email?email=Budi%40Example.TEST&reason=sign-up&redirectTo=%2Forg%2Facme"
    );

    expect(result).toStrictEqual({
      email: "budi@example.test",
      notice: expect.stringContaining("Akun berhasil dibuat"),
      redirectTo: "/org/acme",
      turnstileSiteKey: TEST_ENV.VITE_TURNSTILE_SITE_KEY,
    });
  });

  it("reason=sign-in → pesan email belum diverifikasi", async () => {
    const result = await runLoader(
      "/verify-email?email=budi%40example.test&reason=sign-in"
    );

    expect(result).toMatchObject({
      notice: expect.stringContaining("belum diverifikasi"),
    });
  });

  it("tanpa query / nilai tak dikenal → email dan notice null, redirectTo /", async () => {
    const result = await runLoader(
      "/verify-email?email=bukan-email&reason=lainnya&redirectTo=https%3A%2F%2Fevil.example"
    );

    expect(result).toMatchObject({
      email: null,
      notice: null,
      redirectTo: "/",
    });
  });

  it("sudah login → redirect ke redirectTo internal", async () => {
    const result = await runLoader("/verify-email?redirectTo=%2Fsettings", () =>
      jsonResponse(ME_FIXTURE)
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("location")).toBe("/settings");
  });
});
