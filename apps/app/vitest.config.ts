import { defineConfig } from "vitest/config";

// Tanpa plugin React Router/Cloudflare: test unit & smoke SSR merender modul
// route langsung (mis. `createRoutesStub`), bukan lewat dev server.
export default defineConfig({
  test: {
    environment: "happy-dom",
  },
});
