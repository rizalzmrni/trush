import { describe, expect, it } from "vitest";

import { createRobots } from "./robots";

const SITE_URL = "https://trush.example.test";
const DENY_ALL = "User-agent: *\nDisallow: /\n";

describe("createRobots di luar production", () => {
  it.each(["development", "staging"] as const)(
    "%s menolak semua crawler",
    (appEnv) => {
      expect(createRobots({ appEnv, siteUrl: SITE_URL })).toBe(DENY_ALL);
    }
  );

  it("mengabaikan disallow dan sitemap (tetap tolak semua)", () => {
    expect(
      createRobots({
        appEnv: "staging",
        disallow: ["/api/"],
        sitemapPath: "/sitemap.xml",
        siteUrl: SITE_URL,
      })
    ).toBe(DENY_ALL);
  });
});

describe("createRobots di production", () => {
  it("mengizinkan semua tanpa opsi", () => {
    expect(createRobots({ appEnv: "production", siteUrl: SITE_URL })).toBe(
      "User-agent: *\nAllow: /\n"
    );
  });

  it("tidak memuat Disallow: / (situs produksi tidak boleh hilang dari indeks)", () => {
    const robots = createRobots({ appEnv: "production", siteUrl: SITE_URL });

    expect(robots.split("\n")).not.toContain("Disallow: /");
  });

  it("disallow per path dan Sitemap absolut", () => {
    expect(
      createRobots({
        appEnv: "production",
        disallow: ["/api/", "/__e2e/"],
        sitemapPath: "/sitemap.xml",
        siteUrl: SITE_URL,
      })
    ).toBe(
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /__e2e/",
        "",
        `Sitemap: ${SITE_URL}/sitemap.xml`,
        "",
      ].join("\n")
    );
  });

  it("diakhiri satu newline", () => {
    const robots = createRobots({
      appEnv: "production",
      sitemapPath: "/sitemap.xml",
      siteUrl: SITE_URL,
    });

    expect(robots.endsWith("\n")).toBeTruthy();
    expect(robots.endsWith("\n\n")).toBeFalsy();
  });

  it.each(["sitemap.xml", "//evil.example.test/sitemap.xml"])(
    "menolak sitemapPath %j yang bukan path internal",
    (sitemapPath) => {
      expect(() =>
        createRobots({ appEnv: "production", sitemapPath, siteUrl: SITE_URL })
      ).toThrow(RangeError);
    }
  );
});
