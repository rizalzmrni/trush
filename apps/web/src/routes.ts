import { index, route } from "@react-router/dev/routes";
import type { RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("robots.txt", "routes/robots.ts"),
  // Splat terakhir: URL tak dikenal dirender sebagai 404 dengan status 404.
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
