import { describe, expect, it } from "vitest";
// @vitest-environment node
// Mode server berjalan di Worker; happy-dom memfilter header terlarang
// browser (`cookie`, `origin`) sehingga tidak mewakili runtime.
import { z } from "zod";

import {
  appRequest,
  createFakeApi,
  FORWARDED_FROM_APP_REQUEST,
  jsonResponse,
  pickHeaders,
  SESSION_COOKIE,
} from "../testing/cloudflare";
import {
  ApiError,
  createApiFetch,
  getBrowserApiClient,
  readApiJson,
} from "./api-client";

const BASE_URL = "https://api.example.test";

describe("createApiFetch mode server", () => {
  it("memanggil Service Binding dengan path relatif terhadap baseUrl", async () => {
    const api = createFakeApi(() => new Response("ok"));
    const apiFetch = createApiFetch({
      api: api.binding,
      baseUrl: BASE_URL,
      mode: "server",
      request: appRequest("/"),
    });

    await apiFetch("/api/auth/sign-out", { method: "POST" });

    expect(api.requests[0]?.url.href).toBe(
      "https://api.example.test/api/auth/sign-out"
    );
    expect(api.requests[0]?.method).toBe("POST");
  });

  it("meneruskan hanya header yang diizinkan dari request asli", async () => {
    const api = createFakeApi(() => new Response("ok"));
    const request = appRequest("/", {
      cookie: SESSION_COOKIE,
      headers: {
        authorization: "Bearer palsu",
        "x-captcha-response": "dari-browser",
        "x-forwarded-host": "evil.example",
      },
    });

    await createApiFetch({
      api: api.binding,
      baseUrl: BASE_URL,
      mode: "server",
      request,
    })("/api/me");

    expect(
      pickHeaders(api.requests[0]?.headers, [
        "cookie",
        "origin",
        "cf-connecting-ip",
        "user-agent",
        "authorization",
        "x-captcha-response",
        "x-forwarded-host",
      ])
    ).toStrictEqual({
      ...FORWARDED_FROM_APP_REQUEST,
      authorization: null,
      cookie: SESSION_COOKIE,
      "x-captcha-response": null,
      "x-forwarded-host": null,
    });
  });

  it("header eksplisit pemanggil tidak ditimpa header request asli", async () => {
    const api = createFakeApi(() => new Response("ok"));

    await createApiFetch({
      api: api.binding,
      baseUrl: BASE_URL,
      mode: "server",
      request: appRequest("/", { cookie: SESSION_COOKIE }),
    })("/api/me", { headers: { cookie: "pilihan=pemanggil" } });

    expect(api.requests[0]?.headers.get("cookie")).toBe("pilihan=pemanggil");
  });

  it("tanpa cookie di request asli → tidak ada header cookie", async () => {
    const api = createFakeApi(() => new Response("ok"));

    await createApiFetch({
      api: api.binding,
      baseUrl: BASE_URL,
      mode: "server",
      request: appRequest("/"),
    })("/api/me");

    expect(api.requests[0]?.headers.has("cookie")).toBeFalsy();
  });
});

describe(readApiJson, () => {
  const schema = z.object({ id: z.string() });

  it("mengembalikan body sukses yang tervalidasi", async () => {
    await expect(
      readApiJson(jsonResponse({ id: "a" }), schema)
    ).resolves.toStrictEqual({ id: "a" });
  });

  it("body sukses tidak sesuai skema → error validasi", async () => {
    await expect(readApiJson(jsonResponse({ id: 1 }), schema)).rejects.toThrow(
      z.ZodError
    );
  });

  it("non-2xx → ApiError dengan status dan kode", async () => {
    const error = await readApiJson(
      jsonResponse(
        { error: { code: "FORBIDDEN", message: "Ditolak." } },
        { status: 403 }
      ),
      schema
    ).catch((thrownError: unknown) => thrownError);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect((error as ApiError).isClientError).toBeTruthy();
  });

  it("non-2xx tanpa body JSON → ApiError tanpa kode", async () => {
    const error = await readApiJson(
      new Response("down", { status: 503 }),
      schema
    ).catch((thrownError: unknown) => thrownError);

    expect(error).toMatchObject({ code: undefined, status: 503 });
    expect((error as ApiError).isClientError).toBeFalsy();
  });
});

describe(getBrowserApiClient, () => {
  it("menolak dipanggil di server", () => {
    expect(() => getBrowserApiClient()).toThrow(TypeError);
  });
});
