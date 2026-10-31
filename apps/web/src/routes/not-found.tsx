import { NotFoundPage } from "@trush/design-system/components/feedback/error-page";
import { buttonVariants } from "@trush/design-system/components/ui/button";
import { createNoindexMeta } from "@trush/seo/meta";
import { data, Link } from "react-router";

import type { Route } from "./+types/not-found";

const NOT_FOUND = 404;

// Loader memberi status HTTP 404 pada dokumen; tanpa ini splat route = 200.
export const loader = () => data(null, { status: NOT_FOUND });

export const meta: Route.MetaFunction = () =>
  createNoindexMeta("Halaman tidak ditemukan");

const NotFoundRoute = () => (
  <NotFoundPage
    action={
      <Link className={buttonVariants({ size: "lg" })} to="/">
        Kembali ke beranda
      </Link>
    }
  />
);
export default NotFoundRoute;
