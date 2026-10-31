// @vitest-environment node
// Modul server berjalan di Worker; happy-dom memfilter header terlarang
// browser (`cookie`, `origin`, `set-cookie`) sehingga tidak mewakili runtime.
import { describe, expect, it } from "vitest";

import {
  appRequest,
  createFakeApi,
  createTestContext,
  describeRequest,
  FORWARDED_FROM_APP_REQUEST,
  jsonResponse,
  ME_FIXTURE,
  pickHeaders,
  SESSION_COOKIE,
} from "../../testing/cloudflare";
import type { ApiHandler } from "../../testing/cloudflare";
import { getOptionalSession, requireSession } from "./session.server";

const HTTP_UNAUTHORIZED = 401;

const scopeFor = (handler: ApiHandler, path = "/", cookie = SESSION_COOKIE) => {
  const api = createFakeApi(handler);
  return {
    api,
    scope: {
      context: createTestContext({ api }),
      request: appRequest(path, { cookie }),
    },
  };
};

/** Hasil lemparan (Response redirect, `data(...)`, atau Error). */
const thrown = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Diharapkan melempar.");
};

describe(requireSession, () => {
  it("mengembalikan sesi dan memanggil GET /api/me lewat binding dengan cookie", async () => {
    const { api, scope } = scopeFor(() => jsonResponse(ME_FIXTURE));

    await expect(requireSession(scope)).resolves.toStrictEqual(ME_FIXTURE);

    expect(api.requests).toHaveLength(1);
    const [request] = api.requests;
    expect(describeRequest(request)).toStrictEqual({
      method: "GET",
      path: "/api/me",
    });
    expect(
      pickHeaders(request?.headers, [
        "cookie",
        "origin",
        "cf-connecting-ip",
        "user-agent",
      ])
    ).toStrictEqual({ ...FORWARDED_FROM_APP_REQUEST, cookie: SESSION_COOKIE });
  });

  it("401 → redirect ke /sign-in dengan redirectTo path asal + query", async () => {
    const { scope } = scopeFor(
      () =>
        jsonResponse(
          { error: { code: "UNAUTHORIZED", message: "Belum login." } },
          { status: HTTP_UNAUTHORIZED }
        ),
      "/org/acme/settings?tab=billing"
    );

    const error = await thrown(requireSession(scope));

    expect(error).toBeInstanceOf(Response);
    const response = error as Response;
    expect(response.status).toBe(302);
    const location = new URL(
      response.headers.get("location") ?? "",
      "https://app.example.test"
    );
    expect(location.origin).toBe("https://app.example.test");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("redirectTo")).toBe(
      "/org/acme/settings?tab=billing"
    );
  });

  it("401 di beranda → /sign-in tanpa redirectTo", async () => {
    const { scope } = scopeFor(
      () => new Response(null, { status: HTTP_UNAUTHORIZED }),
      "/"
    );

    const response = (await thrown(requireSession(scope))) as Response;

    expect(response.headers.get("location")).toBe("/sign-in");
  });

  it.each([500, 502, 503, 403, 429])(
    "status %i dilempar ke ErrorBoundary, bukan redirect",
    async (status) => {
      const { scope } = scopeFor(() =>
        jsonResponse({ error: { code: "X", message: "gagal" } }, { status })
      );

      const error = await thrown(requireSession(scope));

      expect(error).not.toBeInstanceOf(Response);
      expect(error).toMatchObject({
        init: { status },
        type: "DataWithResponseInit",
      });
    }
  );

  it("error jaringan Service Binding dilempar apa adanya, bukan redirect", async () => {
    const networkError = new TypeError("Network connection lost.");
    const { scope } = scopeFor(() => {
      throw networkError;
    });

    const error = await thrown(requireSession(scope));

    expect(error).toBe(networkError);
  });

  it("body sukses yang tidak sesuai kontrak ditolak", async () => {
    const { scope } = scopeFor(() => jsonResponse({ user: { id: "x" } }));

    const error = await thrown(requireSession(scope));

    expect(error).not.toBeInstanceOf(Response);
    expect(error).toBeInstanceOf(Error);
  });
});

describe(getOptionalSession, () => {
  it("mengembalikan sesi bila ada", async () => {
    const { scope } = scopeFor(() => jsonResponse(ME_FIXTURE));

    await expect(getOptionalSession(scope)).resolves.toStrictEqual(ME_FIXTURE);
  });

  it.each([401, 500, 503])("status %i → null", async (status) => {
    const { scope } = scopeFor(() => new Response(null, { status }));

    await expect(getOptionalSession(scope)).resolves.toBeNull();
  });

  it("error jaringan → null (halaman login tetap terbuka)", async () => {
    const { scope } = scopeFor(() => {
      throw new TypeError("Network connection lost.");
    });

    await expect(getOptionalSession(scope)).resolves.toBeNull();
  });
});
