import { createRobots } from "@trush/seo/robots";

import { getWebEnv } from "../lib/cloudflare";
import type { Route } from "./+types/robots";

const ONE_HOUR = 3600;

// Resource route (tanpa komponen): `GET /robots.txt`.
export const loader = ({ context }: Route.LoaderArgs) => {
  const env = getWebEnv(context);
  const body = createRobots({
    appEnv: env.APP_ENV,
    siteUrl: env.VITE_SITE_URL,
  });
  return new Response(body, {
    headers: {
      "Cache-Control": `public, max-age=${ONE_HOUR}`,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
