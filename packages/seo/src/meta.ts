/**
 * Helper `meta` React Router. Paket ini tidak membaca env: `siteUrl` dan
 * `appEnv` diteruskan app (dari `@trush/env`).
 */

/** Sama dengan nilai `APP_ENV` (`docs/environments.md`). */
export type SeoEnvironment = "development" | "staging" | "production";

/**
 * Bentuk tag yang dihasilkan; kompatibel secara struktural dengan
 * `MetaDescriptor` React Router tanpa bergantung pada paket itu.
 */
export type MetaTag =
  | { readonly title: string }
  | { readonly content: string; readonly name: string }
  | { readonly content: string; readonly property: string }
  | { readonly href: string; readonly rel: string; readonly tagName: "link" };

export interface MetaImage {
  /** Teks alternatif gambar pratinjau (wajib untuk aksesibilitas). */
  readonly alt: string;
  /** Path internal (`/og.png`) atau URL absolut; selalu dikeluarkan absolut. */
  readonly url: string;
  readonly height?: number;
  readonly width?: number;
}

export interface CreateMetaOptions {
  /** `APP_ENV` dari app. Selain `production` selalu `noindex`. */
  readonly appEnv: SeoEnvironment;
  /** 70–160 karakter; lebih panjang dipotong di batas kata. */
  readonly description: string;
  /** Path halaman yang diawali `/`; query dan hash dibuang dari canonical. */
  readonly path: string;
  /** URL publik situs, mis. `https://trush.id`. */
  readonly siteUrl: string;
  /** Judul halaman tanpa akhiran; hasil akhir `<title> · trush`. */
  readonly title: string;
  readonly image?: MetaImage;
  /** Paksa `noindex` walau produksi (mis. halaman hasil pencarian). */
  readonly noindex?: boolean;
  readonly type?: "article" | "website";
}

export const SITE_NAME = "trush";
export const TITLE_SEPARATOR = " · ";
export const TITLE_MAX_LENGTH = 60;
export const DESCRIPTION_MIN_LENGTH = 70;
export const DESCRIPTION_MAX_LENGTH = 160;
const LOCALE = "id_ID";
const ELLIPSIS = "…";
const NOINDEX = "noindex, nofollow";
const INDEX = "index, follow";
const WHITESPACE = /\s+/gu;

const normalize = (text: string): string =>
  text.replaceAll(WHITESPACE, " ").trim();

/** Potong di batas kata agar `text` + elipsis muat dalam `max` karakter. */
const truncate = (text: string, max: number): string => {
  if (text.length <= max) {
    return text;
  }
  const cut = text.slice(0, max - ELLIPSIS.length);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}${ELLIPSIS}`;
};

/** `<halaman> · trush`, maksimal 60 karakter (bagian halaman yang dipotong). */
export const formatTitle = (title: string): string => {
  const page = normalize(title);
  if (page.length === 0) {
    throw new RangeError("Judul halaman tidak boleh kosong.");
  }
  const suffix = `${TITLE_SEPARATOR}${SITE_NAME}`;
  return `${truncate(page, TITLE_MAX_LENGTH - suffix.length)}${suffix}`;
};

const formatDescription = (description: string): string => {
  const text = normalize(description);
  if (text.length < DESCRIPTION_MIN_LENGTH) {
    throw new RangeError(
      `Description minimal ${DESCRIPTION_MIN_LENGTH} karakter (sekarang ${text.length}).`
    );
  }
  return truncate(text, DESCRIPTION_MAX_LENGTH);
};

/**
 * URL absolut di bawah `siteUrl`. Menolak path yang tidak diawali `/` atau
 * diawali `//` agar canonical tidak bisa menunjuk ke origin lain.
 */
export const toAbsoluteUrl = (path: string, siteUrl: string): string => {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new RangeError(`Path harus diawali "/" (diterima: "${path}").`);
  }
  const url = new URL(path, siteUrl);
  // Cek string saja tidak cukup: parser URL membuang tab/newline dan membaca
  // "\" sebagai "/", jadi "/\t/evil" atau "/\\evil" menjadi protocol-relative.
  if (url.origin !== new URL(siteUrl).origin) {
    throw new RangeError(
      `Path tidak boleh berpindah origin (diterima: ${JSON.stringify(path)}).`
    );
  }
  url.search = "";
  url.hash = "";
  return url.href;
};

const toImageUrl = (url: string, siteUrl: string): string => {
  if (URL.canParse(url)) {
    const absolute = new URL(url);
    if (absolute.protocol !== "https:" && absolute.protocol !== "http:") {
      throw new RangeError(`og:image harus http(s) (diterima: "${url}").`);
    }
    return absolute.href;
  }
  return new URL(toAbsoluteUrl(url, siteUrl)).href;
};

/** Robots meta: selain produksi selalu `noindex`. */
export const robotsContent = (
  appEnv: SeoEnvironment,
  noindex = false
): string => (appEnv === "production" && !noindex ? INDEX : NOINDEX);

const imageTags = (image: MetaImage, siteUrl: string): MetaTag[] => {
  const url = toImageUrl(image.url, siteUrl);
  const tags: MetaTag[] = [
    { content: url, property: "og:image" },
    { content: image.alt, property: "og:image:alt" },
  ];
  if (image.width !== undefined) {
    tags.push({ content: String(image.width), property: "og:image:width" });
  }
  if (image.height !== undefined) {
    tags.push({ content: String(image.height), property: "og:image:height" });
  }
  tags.push(
    { content: url, name: "twitter:image" },
    { content: image.alt, name: "twitter:image:alt" }
  );
  return tags;
};

/**
 * Metadata lengkap satu halaman. `meta` route anak React Router MENGGANTIKAN
 * `meta` induk, jadi helper ini selalu mengisi semua default (canonical, OG,
 * Twitter, robots).
 */
export const createMeta = ({
  appEnv,
  description,
  image,
  noindex = false,
  path,
  siteUrl,
  title,
  type = "website",
}: CreateMetaOptions): MetaTag[] => {
  const fullTitle = formatTitle(title);
  const text = formatDescription(description);
  const canonical = toAbsoluteUrl(path, siteUrl);

  return [
    { title: fullTitle },
    { content: text, name: "description" },
    { content: robotsContent(appEnv, noindex), name: "robots" },
    { href: canonical, rel: "canonical", tagName: "link" },
    { content: SITE_NAME, property: "og:site_name" },
    { content: LOCALE, property: "og:locale" },
    { content: type, property: "og:type" },
    { content: fullTitle, property: "og:title" },
    { content: text, property: "og:description" },
    { content: canonical, property: "og:url" },
    {
      content: image ? "summary_large_image" : "summary",
      name: "twitter:card",
    },
    { content: fullTitle, name: "twitter:title" },
    { content: text, name: "twitter:description" },
    ...(image ? imageTags(image, siteUrl) : []),
  ];
};

/**
 * Halaman error/404 dan halaman `apps/app`: hanya judul + `noindex`, tanpa
 * canonical (halaman ini tidak boleh diindeks).
 */
export const createNoindexMeta = (title: string): MetaTag[] => [
  { title: formatTitle(title) },
  { content: NOINDEX, name: "robots" },
];
