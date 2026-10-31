import { describe, expect, it } from "vitest";

import {
  createMeta,
  createNoindexMeta,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  formatTitle,
  robotsContent,
  TITLE_MAX_LENGTH,
  toAbsoluteUrl,
} from "./meta";
import type { CreateMetaOptions, MetaTag } from "./meta";

const SITE_URL = "https://trush.example.test";
const SUFFIX = " · trush";
const DESCRIPTION =
  "trush membantu tim kecil mengelola pekerjaan harian dalam satu tempat yang rapi.";

const baseOptions = (
  overrides: Partial<CreateMetaOptions> = {}
): CreateMetaOptions => ({
  appEnv: "production",
  description: DESCRIPTION,
  path: "/harga",
  siteUrl: SITE_URL,
  title: "Harga",
  ...overrides,
});

const byName = (tags: MetaTag[], name: string) =>
  tags.find((tag) => "name" in tag && tag.name === name);
const byProperty = (tags: MetaTag[], property: string) =>
  tags.find((tag) => "property" in tag && tag.property === property);
const contentOf = (tag: MetaTag | undefined) =>
  tag && "content" in tag ? tag.content : undefined;
const titleOf = (tags: MetaTag[]) =>
  tags.find((tag): tag is { title: string } => "title" in tag)?.title;
const canonicalOf = (tags: MetaTag[]) =>
  tags.find(
    (tag): tag is Extract<MetaTag, { rel: string }> =>
      "rel" in tag && tag.rel === "canonical"
  )?.href;

describe(formatTitle, () => {
  it("menambah akhiran · trush", () => {
    expect(formatTitle("Harga")).toBe(`Harga${SUFFIX}`);
  });

  it("menormalkan whitespace", () => {
    expect(formatTitle("  Harga \n  paket\tTim  ")).toBe(
      `Harga paket Tim${SUFFIX}`
    );
  });

  it("tepat di batas 60 karakter tidak dipotong", () => {
    const page = "a".repeat(TITLE_MAX_LENGTH - SUFFIX.length);

    expect(formatTitle(page)).toBe(`${page}${SUFFIX}`);
    expect(formatTitle(page)).toHaveLength(TITLE_MAX_LENGTH);
  });

  it("judul panjang dipotong di batas kata dengan elipsis, akhiran utuh", () => {
    const title = formatTitle(
      "Panduan lengkap mengelola pekerjaan tim kecil secara efisien setiap hari"
    );

    expect(title.length).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
    expect(title.endsWith(`…${SUFFIX}`)).toBeTruthy();
    // Kata terakhir sebelum elipsis utuh (bukan potongan kata).
    expect(title).toMatch(
      / (?:tim|kecil|secara|efisien|mengelola|pekerjaan)…/u
    );
  });

  it("satu kata sangat panjang tetap dipotong ke batas", () => {
    const title = formatTitle("x".repeat(200));

    expect(title).toHaveLength(TITLE_MAX_LENGTH);
    expect(title.endsWith(`…${SUFFIX}`)).toBeTruthy();
  });

  it.each(["", "   ", "\n\t"])("menolak judul kosong %j", (title) => {
    expect(() => formatTitle(title)).toThrow(RangeError);
  });
});

describe(toAbsoluteUrl, () => {
  it("menggabungkan path dengan siteUrl", () => {
    expect(toAbsoluteUrl("/harga", SITE_URL)).toBe(`${SITE_URL}/harga`);
  });

  it("membuang query dan hash", () => {
    expect(toAbsoluteUrl("/harga?utm_source=x&a=1#paket", SITE_URL)).toBe(
      `${SITE_URL}/harga`
    );
  });

  it.each(["harga", "", "https://evil.example.test/", "//evil.example.test/x"])(
    "menolak path %j yang bukan path internal",
    (path) => {
      expect(() => toAbsoluteUrl(path, SITE_URL)).toThrow(RangeError);
    }
  );

  // Regresi: parser URL membuang tab/newline, sehingga "/\t/evil" menjadi
  // "//evil" (protocol-relative) setelah lolos cek `startsWith("//")`.
  it.each(["/\t/evil.example.test/x", "/\n/evil.example.test/x"])(
    "path %j tidak boleh berpindah origin",
    (path) => {
      let href: string | undefined;
      try {
        href = toAbsoluteUrl(path, SITE_URL);
      } catch {
        href = undefined;
      }

      expect(
        href === undefined || new URL(href).origin === SITE_URL
      ).toBeTruthy();
    }
  );

  // Regresi: "\" diperlakukan sebagai "/" oleh parser URL untuk skema http(s).
  it("path /\\evil tidak boleh berpindah origin", () => {
    let href: string | undefined;
    try {
      href = toAbsoluteUrl("/\\evil.example.test/x", SITE_URL);
    } catch {
      href = undefined;
    }

    expect(
      href === undefined || new URL(href).origin === SITE_URL
    ).toBeTruthy();
  });
});

describe(robotsContent, () => {
  it.each([
    ["production", false, "index, follow"],
    ["production", true, "noindex, nofollow"],
    ["staging", false, "noindex, nofollow"],
    ["development", false, "noindex, nofollow"],
  ] as const)("%s noindex=%s → %s", (appEnv, noindex, expected) => {
    expect(robotsContent(appEnv, noindex)).toBe(expected);
  });
});

describe(createMeta, () => {
  it("mengisi semua default: title, description, robots, canonical, OG, Twitter", () => {
    const tags = createMeta(baseOptions());
    const title = `Harga${SUFFIX}`;

    expect(titleOf(tags)).toBe(title);
    expect(contentOf(byName(tags, "description"))).toBe(DESCRIPTION);
    expect(canonicalOf(tags)).toBe(`${SITE_URL}/harga`);
    expect(tags).toStrictEqual(
      expect.arrayContaining([
        { content: "index, follow", name: "robots" },
        { content: "trush", property: "og:site_name" },
        { content: "id_ID", property: "og:locale" },
        { content: "website", property: "og:type" },
        { content: title, property: "og:title" },
        { content: DESCRIPTION, property: "og:description" },
        { content: `${SITE_URL}/harga`, property: "og:url" },
        { content: "summary", name: "twitter:card" },
        { content: title, name: "twitter:title" },
        { content: DESCRIPTION, name: "twitter:description" },
      ])
    );
  });

  it("tanpa image tidak ada og:image", () => {
    const tags = createMeta(baseOptions());

    expect(byProperty(tags, "og:image")).toBeUndefined();
    expect(byName(tags, "twitter:image")).toBeUndefined();
  });

  it("canonical dan og:url absolut tanpa query/hash", () => {
    const tags = createMeta(baseOptions({ path: "/blog/a?ref=x#top" }));

    expect(canonicalOf(tags)).toBe(`${SITE_URL}/blog/a`);
    expect(contentOf(byProperty(tags, "og:url"))).toBe(`${SITE_URL}/blog/a`);
  });

  it.each(["staging", "development"] as const)(
    "%s selalu noindex",
    (appEnv) => {
      const tags = createMeta(baseOptions({ appEnv }));

      expect(contentOf(byName(tags, "robots"))).toBe("noindex, nofollow");
    }
  );

  it("noindex=true di production → noindex", () => {
    const tags = createMeta(baseOptions({ noindex: true }));

    expect(contentOf(byName(tags, "robots"))).toBe("noindex, nofollow");
  });

  it("tepat satu tag robots, title, dan canonical", () => {
    const tags = createMeta(baseOptions({ appEnv: "staging" }));

    expect(
      tags.filter((tag) => "name" in tag && tag.name === "robots")
    ).toHaveLength(1);
    expect(tags.filter((tag) => "title" in tag)).toHaveLength(1);
    expect(tags.filter((tag) => "rel" in tag)).toHaveLength(1);
  });

  it("type article diteruskan ke og:type", () => {
    const tags = createMeta(baseOptions({ type: "article" }));

    expect(contentOf(byProperty(tags, "og:type"))).toBe("article");
  });

  it("description tepat 70 dan 160 karakter diterima utuh", () => {
    const min = "a".repeat(DESCRIPTION_MIN_LENGTH);
    const max = "b".repeat(DESCRIPTION_MAX_LENGTH);

    expect(
      contentOf(
        byName(createMeta(baseOptions({ description: min })), "description")
      )
    ).toBe(min);
    expect(
      contentOf(
        byName(createMeta(baseOptions({ description: max })), "description")
      )
    ).toBe(max);
  });

  it("description < 70 karakter (setelah normalisasi whitespace) ditolak", () => {
    const padded = `  ${"kata ".repeat(10)}   \n\n   `;

    expect(() =>
      createMeta(
        baseOptions({ description: "a".repeat(DESCRIPTION_MIN_LENGTH - 1) })
      )
    ).toThrow(RangeError);
    expect(() => createMeta(baseOptions({ description: padded }))).toThrow(
      RangeError
    );
  });

  it("description > 160 dipotong di batas kata dengan elipsis", () => {
    const long = "kata panjang ".repeat(30);
    const description = contentOf(
      byName(createMeta(baseOptions({ description: long })), "description")
    );

    expect(description?.length).toBeLessThanOrEqual(DESCRIPTION_MAX_LENGTH);
    expect(description?.endsWith("…")).toBeTruthy();
    expect(description).toMatch(/(?:kata|panjang)…$/u);
  });

  it("og:description dan twitter:description sama dengan description", () => {
    const tags = createMeta(baseOptions({ description: "kata ".repeat(50) }));
    const description = contentOf(byName(tags, "description"));

    expect(contentOf(byProperty(tags, "og:description"))).toBe(description);
    expect(contentOf(byName(tags, "twitter:description"))).toBe(description);
  });

  it("menolak title kosong dan path tidak valid", () => {
    expect(() => createMeta(baseOptions({ title: " " }))).toThrow(RangeError);
    expect(() => createMeta(baseOptions({ path: "harga" }))).toThrow(
      RangeError
    );
    expect(() =>
      createMeta(baseOptions({ path: "//evil.example.test/harga" }))
    ).toThrow(RangeError);
  });
});

describe("createMeta dengan image", () => {
  it("path relatif dijadikan absolut di bawah siteUrl", () => {
    const tags = createMeta(
      baseOptions({ image: { alt: "Pratinjau trush", url: "/og.png" } })
    );

    expect(contentOf(byProperty(tags, "og:image"))).toBe(`${SITE_URL}/og.png`);
    expect(contentOf(byName(tags, "twitter:image"))).toBe(`${SITE_URL}/og.png`);
    expect(contentOf(byName(tags, "twitter:card"))).toBe("summary_large_image");
  });

  it("URL absolut https dipakai apa adanya", () => {
    const url = "https://cdn.example.test/og.png";
    const tags = createMeta(baseOptions({ image: { alt: "x", url } }));

    expect(contentOf(byProperty(tags, "og:image"))).toBe(url);
  });

  it("alt, width, height diteruskan", () => {
    const tags = createMeta(
      baseOptions({
        image: { alt: "Pratinjau", height: 630, url: "/og.png", width: 1200 },
      })
    );

    expect(contentOf(byProperty(tags, "og:image:alt"))).toBe("Pratinjau");
    expect(contentOf(byName(tags, "twitter:image:alt"))).toBe("Pratinjau");
    expect(contentOf(byProperty(tags, "og:image:width"))).toBe("1200");
    expect(contentOf(byProperty(tags, "og:image:height"))).toBe("630");
  });

  it.each([
    "file:///etc/og.png",
    "mailto:tim@example.test",
    "data:image/png;base64,AAAA",
    "ftp://cdn.example.test/og.png",
    "og.png",
    "//cdn.example.test/og.png",
  ])("menolak og:image %j", (url) => {
    expect(() => createMeta(baseOptions({ image: { alt: "x", url } }))).toThrow(
      RangeError
    );
  });
});

describe(createNoindexMeta, () => {
  it("hanya title + robots noindex, tanpa canonical", () => {
    expect(createNoindexMeta("Halaman tidak ditemukan")).toStrictEqual([
      { title: `Halaman tidak ditemukan${SUFFIX}` },
      { content: "noindex, nofollow", name: "robots" },
    ]);
  });

  it("menolak judul kosong", () => {
    expect(() => createNoindexMeta("")).toThrow(RangeError);
  });
});
