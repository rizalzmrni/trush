import { describe, expect, it } from "vitest";

import { createTestContext, envFor } from "../testing/cloudflare";
import type { TestEnvOverrides } from "../testing/cloudflare";
import { loader } from "./robots";

const ROBOTS_URL = "https://trush.example.test/robots.txt";

const getRobots = (overrides: TestEnvOverrides) =>
  loader({
    context: createTestContext(overrides),
    params: {},
    pattern: "/robots.txt",
    request: new Request(ROBOTS_URL),
    url: new URL(ROBOTS_URL),
  });

describe("GET /robots.txt", () => {
  it.each(["development", "staging"] as const)(
    "%s menolak semua crawler",
    async (appEnv) => {
      const response = getRobots(envFor(appEnv));

      await expect(response.text()).resolves.toBe(
        "User-agent: *\nDisallow: /\n"
      );
    }
  );

  it("production mengizinkan crawler", async () => {
    const body = await getRobots(envFor("production")).text();

    expect(body).toContain("Allow: /");
    expect(body.split("\n")).not.toContain("Disallow: /");
  });

  it("text/plain UTF-8 dengan cache publik", () => {
    const response = getRobots(envFor("production"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8"
    );
    expect(response.headers.get("cache-control")).toMatch(
      /^public, max-age=\d+$/u
    );
  });

  it("env tidak valid melempar (ditangani ErrorBoundary/500), bukan robots longgar", () => {
    expect(() =>
      getRobots({ ...envFor("production"), VITE_APP_ENV: "staging" })
    ).toThrow(/APP_ENV/u);
  });
});
