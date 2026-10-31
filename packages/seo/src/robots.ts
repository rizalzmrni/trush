import { toAbsoluteUrl } from "./meta";
import type { SeoEnvironment } from "./meta";

export interface CreateRobotsOptions {
  /** `APP_ENV` dari app. Selain `production`, semua crawler ditolak. */
  readonly appEnv: SeoEnvironment;
  /** URL publik situs, mis. `https://trush.id`. */
  readonly siteUrl: string;
  /** Path yang tidak boleh di-crawl di produksi, mis. `["/api/"]`. */
  readonly disallow?: readonly string[];
  /** Path sitemap (`/sitemap.xml`); dikeluarkan sebagai URL absolut. */
  readonly sitemapPath?: string;
}

/** Isi `robots.txt` untuk resource route `robots.txt` app. */
export const createRobots = ({
  appEnv,
  disallow = [],
  siteUrl,
  sitemapPath,
}: CreateRobotsOptions): string => {
  if (appEnv !== "production") {
    return "User-agent: *\nDisallow: /\n";
  }
  const lines = [
    "User-agent: *",
    "Allow: /",
    ...disallow.map((path) => `Disallow: ${path}`),
  ];
  if (sitemapPath !== undefined) {
    lines.push("", `Sitemap: ${toAbsoluteUrl(sitemapPath, siteUrl)}`);
  }
  return `${lines.join("\n")}\n`;
};
