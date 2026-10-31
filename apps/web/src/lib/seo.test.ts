import { describe, expect, it } from "vitest";

import { pageMeta } from "./seo";

const PAGE = {
  description:
    "trush membantu tim kecil mengelola pekerjaan harian dalam satu tempat yang rapi.",
  path: "/harga",
  title: "Harga",
};

describe(pageMeta, () => {
  it("dengan data situs: meta lengkap ber-canonical absolut", () => {
    const tags = pageMeta(
      { appEnv: "production", siteUrl: "https://trush.example.test" },
      PAGE
    );

    expect(tags).toContainEqual({
      href: "https://trush.example.test/harga",
      rel: "canonical",
      tagName: "link",
    });
    expect(tags).toContainEqual({ content: "index, follow", name: "robots" });
  });

  it("tanpa data situs (loader root gagal): noindex tanpa canonical", () => {
    const tags = pageMeta(undefined, PAGE);

    expect(tags).toContainEqual({
      content: "noindex, nofollow",
      name: "robots",
    });
    expect(tags.some((tag) => "rel" in tag)).toBeFalsy();
  });
});
