import { createMeta, createNoindexMeta } from "@trush/seo/meta";
import type {
  CreateMetaOptions,
  MetaTag,
  SeoEnvironment,
} from "@trush/seo/meta";

/** Data situs dari loader root, dibutuhkan setiap `meta` halaman. */
export interface SiteData {
  readonly appEnv: SeoEnvironment;
  readonly siteUrl: string;
}

type PageMeta = Omit<CreateMetaOptions, "appEnv" | "siteUrl">;

/**
 * `meta` halaman indeksabel. Bila loader root gagal (data tidak ada), halaman
 * jatuh ke `noindex` agar tidak pernah diindeks tanpa canonical yang benar.
 */
export const pageMeta = (
  site: SiteData | undefined,
  page: PageMeta
): MetaTag[] =>
  site ? createMeta({ ...page, ...site }) : createNoindexMeta(page.title);
