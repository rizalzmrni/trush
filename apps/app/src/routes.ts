import { index, route } from "@react-router/dev/routes";
import type { RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("sign-in", "routes/auth/sign-in.tsx"),
  route("sign-up", "routes/auth/sign-up.tsx"),
  route("sign-out", "routes/auth/sign-out.ts"),
  route("verify-email", "routes/auth/verify-email.tsx"),
  route("forgot-password", "routes/auth/forgot-password.tsx"),
  route("reset-password", "routes/auth/reset-password.tsx"),
  route("settings/phone", "routes/settings-phone.tsx"),
  // Splat terakhir: URL tak dikenal dirender sebagai 404 dengan status 404.
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
