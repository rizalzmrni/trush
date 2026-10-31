import { createNoindexMeta } from "@trush/seo/meta";
import { data } from "react-router";

import { NotFound } from "../features/errors/status-pages";
import type { Route } from "./+types/not-found";

const NOT_FOUND = 404;

// Loader memberi status HTTP 404 pada dokumen; tanpa ini splat route = 200.
export const loader = () => data(null, { status: NOT_FOUND });

export const meta: Route.MetaFunction = () =>
  createNoindexMeta("Halaman tidak ditemukan");

const NotFoundRoute = () => <NotFound />;
export default NotFoundRoute;
