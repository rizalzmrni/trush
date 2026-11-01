import { createAppEnv } from "@trush/env/app";
import { describe, expect, it } from "vitest";

import { envFor, TEST_ENV } from "../testing/cloudflare";
import type { AppEnvName } from "../testing/cloudflare";
import { needsTurnstile } from "./route-handle";
import {
  applySecurityHeaders,
  createNonce,
  TURNSTILE_ORIGIN,
} from "./security-headers.server";

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u;
const NONCE_BYTES = 16;
const SAMPLE_SIZE = 50;
const NONCE = "bm9uY2UtdWppLTEyMw==";
const HSTS_VALUE = "max-age=31536000; includeSubDomains";
const OFFICIAL_URL = "https://app.trush.example.test/";
// Site key non-uji palsu; kunci uji Cloudflare ditolak saat production.
const FAKE_PROD_SITE_KEY = "0x4AAAAAAApalsuPalsuPalsu";

const appEnv = (name: AppEnvName) =>
  createAppEnv({
    isServer: true,
    runtimeEnv: {
      ...TEST_ENV,
      ...envFor(name),
      ...(name === "production"
        ? { VITE_TURNSTILE_SITE_KEY: FAKE_PROD_SITE_KEY }
        : {}),
    },
  });

const headersFor = (
  name: AppEnvName,
  {
    requestUrl = OFFICIAL_URL,
    turnstile,
  }: {
    requestUrl?: string;
    turnstile?: boolean;
  } = {}
) => {
  const headers = new Headers();
  applySecurityHeaders(headers, {
    env: appEnv(name),
    nonce: NONCE,
    requestUrl,
    turnstile,
  });
  return headers;
};

const directive = (headers: Headers, name: string): string =>
  (headers.get("content-security-policy") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `)) ?? "";

describe(createNonce, () => {
  it("base64 16 byte dan berbeda tiap panggilan", () => {
    const nonces = new Set(Array.from({ length: SAMPLE_SIZE }, createNonce));
    expect(nonces.size).toBe(SAMPLE_SIZE);
    for (const nonce of nonces) {
      expect(nonce).toMatch(BASE64);
      expect(atob(nonce)).toHaveLength(NONCE_BYTES);
    }
  });
});

describe(applySecurityHeaders, () => {
  it("memasang header dasar", () => {
    const headers = headersFor("production");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(directive(headers, "frame-ancestors")).toBe(
      "frame-ancestors 'none'"
    );
    expect(directive(headers, "object-src")).toBe("object-src 'none'");
    expect(directive(headers, "form-action")).toBe("form-action 'self'");
  });

  it("script-src memakai nonce tanpa unsafe-inline/unsafe-eval", () => {
    const script = directive(headersFor("production"), "script-src");
    expect(script).toContain(`'nonce-${NONCE}'`);
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it("connect-src memuat origin api; ws hanya saat development", () => {
    const prod = directive(headersFor("production"), "connect-src");
    expect(prod).toBe("connect-src 'self' https://api.example.test");

    const dev = directive(headersFor("development"), "connect-src");
    expect(dev).toContain("https://api.example.test");
    expect(dev).toContain("ws:");
    expect(dev).toContain("wss:");
  });

  it("Turnstile hanya diizinkan bila halaman memuat widget", () => {
    const without = headersFor("production");
    expect(directive(without, "script-src")).not.toContain(TURNSTILE_ORIGIN);
    expect(directive(without, "frame-src")).toBe("frame-src 'none'");

    const withWidget = headersFor("production", { turnstile: true });
    expect(directive(withWidget, "script-src")).toContain(TURNSTILE_ORIGIN);
    expect(directive(withWidget, "frame-src")).toBe(
      `frame-src ${TURNSTILE_ORIGIN}`
    );
  });

  it("HSTS saat production di domain resmi", () => {
    expect(headersFor("production").get("strict-transport-security")).toBe(
      HSTS_VALUE
    );
  });

  it.each(["development", "staging"] as const)("tanpa HSTS saat %s", (name) => {
    expect(headersFor(name).has("strict-transport-security")).toBeFalsy();
  });

  it.each([
    "http://localhost:5173/",
    "http://127.0.0.1:8788/",
    "http://[::1]:5173/",
    "https://trush-app-production.akun.workers.dev/",
  ])("tanpa HSTS di host tidak resmi %s walau production", (requestUrl) => {
    expect(
      headersFor("production", { requestUrl }).has("strict-transport-security")
    ).toBeFalsy();
  });
});

describe(needsTurnstile, () => {
  it("true bila salah satu handle meminta Turnstile", () => {
    expect(needsTurnstile([undefined, { turnstile: true }])).toBeTruthy();
  });

  it.each([
    [[]],
    [[undefined, null]],
    [[{ turnstile: false }]],
    [[{ turnstile: "true" }]],
    [["turnstile"]],
  ])("false untuk %j", (handles) => {
    expect(needsTurnstile(handles)).toBeFalsy();
  });
});
