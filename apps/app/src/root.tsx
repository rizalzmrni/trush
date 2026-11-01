import { QueryClientProvider } from "@tanstack/react-query";
import {
  NotFoundPage,
  ServerErrorPage,
} from "@trush/design-system/components/feedback/error-page";
import { DesignSystemProvider } from "@trush/design-system/components/provider";
import { buttonVariants } from "@trush/design-system/components/ui/button";
import { fontLinks, fontVariables } from "@trush/design-system/lib/font";
import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { useNonce } from "./lib/nonce";
import { createQueryClient } from "./lib/query-client";

import designSystemCss from "@trush/design-system/styles/globals.css?url";

const NOT_FOUND = 404;

export const links: Route.LinksFunction = () => [
  { href: designSystemCss, rel: "stylesheet" },
  ...fontLinks,
];

const errorTitle = (error: unknown): string =>
  isRouteErrorResponse(error) && error.status === NOT_FOUND
    ? "Halaman tidak ditemukan · trush"
    : "Terjadi kesalahan · trush";

// Aplikasi di balik login: tidak pernah diindeks.
export const meta: Route.MetaFunction = ({ error }) => [
  { title: error ? errorTitle(error) : "trush" },
  { content: "noindex, nofollow", name: "robots" },
];

export const Layout = ({ children }: { children: ReactNode }) => {
  const nonce = useNonce();
  return (
    // next-themes menambah class `.dark` sebelum hydration.
    <html lang="id" suppressHydrationWarning>
      <head>
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

const App = () => {
  // Satu QueryClient per render tree: per request di server, per tab di
  // browser. Tidak pernah di scope modul (data pengguna bocor antar-request).
  // `useMemo` tanpa dependensi: dibuat sekali per mount root.
  const queryClient = useMemo(() => createQueryClient(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
};
export default App;

const homeAction = (
  <Link className={buttonVariants({ size: "lg" })} to="/">
    Kembali ke beranda
  </Link>
);

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) =>
  isRouteErrorResponse(error) && error.status === NOT_FOUND ? (
    <NotFoundPage action={homeAction} />
  ) : (
    <ServerErrorPage action={homeAction} />
  );
