import { DesignSystemProvider } from "@trush/design-system/components/provider";
import { fontLinks, fontVariables } from "@trush/design-system/lib/font";
import { createNoindexMeta } from "@trush/seo/meta";
import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { NotFound, ServerError } from "./features/errors/status-pages";
import { getWebEnv } from "./lib/cloudflare";
import { useNonce } from "./lib/nonce";

import designSystemCss from "@trush/design-system/styles/globals.css?url";

const NOT_FOUND = 404;

export const links: Route.LinksFunction = () => [
  { href: designSystemCss, rel: "stylesheet" },
  ...fontLinks,
];

export const loader = ({ context }: Route.LoaderArgs) => {
  const env = getWebEnv(context);
  return {
    appEnv: env.APP_ENV,
    siteUrl: env.VITE_SITE_URL,
  };
};

/** Hanya dipakai saat error; halaman normal mengisi `meta` sendiri. */
export const meta: Route.MetaFunction = ({ error }) => {
  if (!error) {
    return [];
  }
  const notFound = isRouteErrorResponse(error) && error.status === NOT_FOUND;
  return createNoindexMeta(
    notFound ? "Halaman tidak ditemukan" : "Terjadi kesalahan"
  );
};

export const Layout = ({ children }: { children: ReactNode }) => {
  const nonce = useNonce();
  return (
    // next-themes menambah class `.dark` sebelum hydration.
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Meta dokumen dasar; meta SEO berasal dari @trush/seo lewat <Meta />. */}
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <Meta />
        <Links />
      </head>
      <body className={fontVariables}>
        <DesignSystemProvider nonce={nonce}>{children}</DesignSystemProvider>
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
};

const App = () => <Outlet />;
export default App;

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) =>
  isRouteErrorResponse(error) && error.status === NOT_FOUND ? (
    <NotFound />
  ) : (
    <ServerError />
  );
