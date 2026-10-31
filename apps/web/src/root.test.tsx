import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub, data, Links, Meta } from "react-router";
import type { MetaDescriptor, MetaFunction } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import App, {
  ErrorBoundary,
  Layout,
  loader as rootLoader,
  meta as rootMeta,
} from "./root";
import Home, { loader as homeLoader, meta as homeMeta } from "./routes/home";
import NotFoundRoute, {
  loader as notFoundLoader,
  meta as notFoundMeta,
} from "./routes/not-found";
import { createTestContext, envFor, TEST_ENV } from "./testing/cloudflare";
import type { TestEnvOverrides } from "./testing/cloudflare";

const SECRET_MESSAGE = "detail-internal-rahasia-palsu";

/**
 * `meta` hasil typegen bertipe sempit per route (loaderData, params), sedangkan
 * `createRoutesStub` menerima `MetaFunction` generik. Stub mengisi argumen yang
 * sama saat runtime, jadi hanya tipenya yang dilebarkan.
 */
const asStubMeta = (meta: (args: never) => MetaDescriptor[]): MetaFunction =>
  meta as unknown as MetaFunction;

/** Root uji: `<Meta />` dan `<Links />` dirender agar meta ikut diperiksa. */
const TestRoot = () => (
  <>
    <Meta />
    <Links />
    <App />
  </>
);

/**
 * Di app nyata `Layout` membungkus juga ErrorBoundary, sehingga `<Meta />`
 * tetap dirender saat error; harness ini meniru itu.
 */
const TestErrorBoundary = (props: ComponentProps<typeof ErrorBoundary>) => (
  <>
    <Meta />
    <ErrorBoundary {...props} />
  </>
);

interface StubOptions {
  env?: TestEnvOverrides;
  homeLoader?: () => unknown;
}

const createStub = ({
  env = {},
  homeLoader: overrideHomeLoader,
}: StubOptions = {}) =>
  createRoutesStub(
    [
      {
        Component: TestRoot,
        ErrorBoundary: TestErrorBoundary,
        children: [
          {
            Component: Home,
            id: "routes/home",
            index: true,
            loader: overrideHomeLoader ?? homeLoader,
            meta: asStubMeta(homeMeta),
          },
          {
            Component: NotFoundRoute,
            id: "routes/not-found",
            loader: notFoundLoader,
            meta: asStubMeta(notFoundMeta),
            path: "*",
          },
        ],
        id: "root",
        loader: rootLoader,
        meta: asStubMeta(rootMeta),
        path: "/",
      },
    ],
    createTestContext(env)
  );

const renderAt = (path: string, options?: StubOptions) => {
  const Stub = createStub(options);
  return render(<Stub initialEntries={[path]} />);
};

const metaContent = (selector: string) =>
  document.querySelector(selector)?.getAttribute("content");

describe("SSR root", () => {
  it("Layout merender dokumen HTML lengkap (lang id, charset, viewport, body)", () => {
    const Stub = createRoutesStub(
      [
        {
          Component: () => (
            <Layout>
              <App />
            </Layout>
          ),
          children: [{ Component: Home, id: "routes/home", index: true }],
          id: "root",
          path: "/",
        },
      ],
      createTestContext()
    );
    const html = renderToString(
      <Stub
        hydrationData={{
          loaderData: {
            root: { appEnv: "development", siteUrl: TEST_ENV.VITE_SITE_URL },
            "routes/home": { appUrl: TEST_ENV.VITE_APP_URL },
          },
        }}
        initialEntries={["/"]}
      />
    );

    expect(html).toContain('<html lang="id"');
    expect(html).toMatch(/<meta charSet="utf-8"\/?>/iu);
    expect(html).toContain('name="viewport"');
    expect(html).toContain("Kelola pekerjaan tim dalam satu tempat");
  });
});

describe("beranda /", () => {
  afterEach(cleanup);

  it("merender heading utama dan landmark main", async () => {
    renderAt("/");

    await expect(
      screen.findByRole("heading", {
        level: 1,
        name: "Kelola pekerjaan tim dalam satu tempat",
      })
    ).resolves.toBeDefined();
    expect(screen.getByRole("main")).toBeDefined();
  });

  it("tautan daftar/masuk absolut ke VITE_APP_URL, bukan ditulis keras", async () => {
    renderAt("/", { env: { VITE_APP_URL: "https://app.lain.example.test" } });
    const main = await screen.findByRole("main");

    expect(
      within(main)
        .getByRole("link", { name: "Mulai gratis" })
        .getAttribute("href")
    ).toBe("https://app.lain.example.test/sign-up");
    expect(
      within(main).getByRole("link", { name: "Masuk" }).getAttribute("href")
    ).toBe("https://app.lain.example.test/sign-in");
  });

  it("title, canonical, og:url absolut dari VITE_SITE_URL", async () => {
    renderAt("/");
    await screen.findByRole("main");

    expect(document.title).toBe("Beranda · trush");
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href")
    ).toBe(`${TEST_ENV.VITE_SITE_URL}/`);
    expect(metaContent('meta[property="og:url"]')).toBe(
      `${TEST_ENV.VITE_SITE_URL}/`
    );
    expect(
      metaContent('meta[name="description"]')?.length
    ).toBeGreaterThanOrEqual(70);
  });

  it.each(["development", "staging"] as const)(
    "%s: robots noindex",
    async (appEnv) => {
      renderAt("/", { env: envFor(appEnv) });
      await screen.findByRole("main");

      expect(metaContent('meta[name="robots"]')).toBe("noindex, nofollow");
    }
  );

  it("production: robots index", async () => {
    renderAt("/", { env: envFor("production") });
    await screen.findByRole("main");

    expect(metaContent('meta[name="robots"]')).toBe("index, follow");
  });

  it("tepat satu tag robots dan satu canonical", async () => {
    renderAt("/");
    await screen.findByRole("main");

    expect(document.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  });
});

describe("404", () => {
  afterEach(cleanup);

  it("loader splat memberi status HTTP 404", () => {
    const result = notFoundLoader();

    expect(result).toStrictEqual(data(null, { status: 404 }));
  });

  it.each(["/tidak-ada", "/blog/tidak/ada"])(
    "%s merender halaman 404 noindex tanpa canonical",
    async (path) => {
      renderAt(path);

      await expect(
        screen.findByRole("heading", {
          level: 1,
          name: "Halaman tidak ditemukan",
        })
      ).resolves.toBeDefined();
      expect(document.title).toBe("Halaman tidak ditemukan · trush");
      expect(metaContent('meta[name="robots"]')).toBe("noindex, nofollow");
      expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    }
  );

  it("menyediakan tautan kembali ke beranda", async () => {
    renderAt("/tidak-ada");

    const link = await screen.findByRole("link", {
      name: "Kembali ke beranda",
    });

    expect(link.getAttribute("href")).toBe("/");
  });
});

describe(ErrorBoundary, () => {
  afterEach(cleanup);

  it("error loader → halaman kesalahan tanpa membocorkan pesan internal", async () => {
    renderAt("/", {
      homeLoader: () => {
        throw new Error(SECRET_MESSAGE);
      },
    });

    await expect(
      screen.findByRole("heading", {
        level: 1,
        name: "Halaman gagal dimuat",
      })
    ).resolves.toBeDefined();
    expect(document.body.textContent).not.toContain(SECRET_MESSAGE);
    expect(document.title).toBe("Terjadi kesalahan · trush");
    expect(metaContent('meta[name="robots"]')).toBe("noindex, nofollow");
  });

  it("response 404 yang dilempar → halaman 404", async () => {
    renderAt("/", {
      homeLoader: () => {
        throw data(null, { status: 404 });
      },
    });

    await expect(
      screen.findByRole("heading", {
        level: 1,
        name: "Halaman tidak ditemukan",
      })
    ).resolves.toBeDefined();
    expect(document.title).toBe("Halaman tidak ditemukan · trush");
  });

  it("env tidak valid di loader root → halaman kesalahan, bukan crash", async () => {
    renderAt("/", { env: { VITE_SITE_URL: "bukan-url" } });

    await expect(
      screen.findByRole("heading", {
        level: 1,
        name: "Halaman gagal dimuat",
      })
    ).resolves.toBeDefined();
    expect(document.body.textContent).not.toContain("bukan-url");
    expect(document.body.textContent).not.toContain("VITE_SITE_URL");
  });
});
