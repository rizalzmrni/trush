import { index, route } from "@react-router/dev/routes";
import type { RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("sign-in", "routes/sign-in.tsx"),
  route("sign-up", "routes/sign-up.tsx"),
  route("sign-out", "routes/sign-out.ts"),
  route("settings/phone", "routes/settings-phone.tsx"),
  // Splat terakhir: URL tak dikenal dirender sebagai 404 dengan status 404.
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
