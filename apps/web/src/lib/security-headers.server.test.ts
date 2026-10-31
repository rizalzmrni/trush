import { createWebEnv } from "@trush/env/web";
import { describe, expect, it } from "vitest";

import { envFor, TEST_ENV } from "../testing/cloudflare";
import { applySecurityHeaders, createNonce } from "./security-headers.server";

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u;
const NONCE_BYTES = 16;
const SAMPLE_SIZE = 50;

const webEnv = (appEnv: "development" | "staging" | "production") =>
  createWebEnv({
    isServer: true,
    runtimeEnv: { ...TEST_ENV, ...envFor(appEnv) },
  });

const headersFor = (
  appEnv: "development" | "staging" | "production",
  nonce = "bm9uY2UtdWppLTEyMw=="
) => {
  const headers = new Headers();
  applySecurityHeaders(headers, { env: webEnv(appEnv), nonce });
  return headers;
};

const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `)) ?? "";

describe(createNonce, () => {
  it("base64 dari 16 byte acak", () => {
    const nonce = createNonce();

    expect(nonce).toMatch(BASE64);
    expect(atob(nonce)).toHaveLength(NONCE_BYTES);
  });

  it("berbeda setiap panggilan", () => {
    const nonces = new Set(
      Array.from({ length: SAMPLE_SIZE }, () => createNonce())
    );

    expect(nonces.size).toBe(SAMPLE_SIZE);
  });
});

describe(applySecurityHeaders, () => {
  it("script-src memakai nonce, tanpa 'unsafe-inline' atau 'unsafe-eval'", () => {
    const csp = headersFor("production", "abc123").get(
      "content-security-policy"
    );
    const scriptSrc = directive(csp ?? "", "script-src");

    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("CSP melarang framing, plugin, dan base/form lintas origin", () => {
    const csp = headersFor("production").get("content-security-policy") ?? "";

    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
  });

  it("nosniff dan Referrer-Policy", () => {
    const headers = headersFor("staging");

    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin"
    );
  });

  it("connect-src mengizinkan WebSocket HMR hanya di development", () => {
    const devCsp = headersFor("development").get("content-security-policy");
    const prodCsp = headersFor("production").get("content-security-policy");

    expect(directive(devCsp ?? "", "connect-src")).toContain("ws:");
    expect(directive(prodCsp ?? "", "connect-src")).toBe("connect-src 'self'");
  });

  it("HSTS hanya di production", () => {
    expect(headersFor("production").get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains"
    );
    expect(headersFor("staging").get("strict-transport-security")).toBeNull();
    expect(
      headersFor("development").get("strict-transport-security")
    ).toBeNull();
  });
});
