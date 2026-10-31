import { createRequestHandler, RouterContextProvider } from "react-router";

import { cloudflareContext } from "./lib/cloudflare";

// `import.meta.env.MODE` hanya memilih mode build React Router (detail error
// saat dev), bukan penanda lingkungan; lingkungan tetap dari APP_ENV.
const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { ctx, env });
    return requestHandler(request, context);
  },
} satisfies ExportedHandler<Env>;
