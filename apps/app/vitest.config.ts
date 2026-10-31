import { defineConfig } from "vitest/config";

// Tanpa plugin React Router/Cloudflare: test unit & smoke SSR merender modul
// route langsung (mis. `createRoutesStub`), bukan lewat dev server.
// Dua project: logika non-komponen (`*.test.ts`: loader/action, `*.server`,
// util `src/lib`) di node agar `Request`/`Response`/`fetch` sama dengan
// runtime server; komponen (`*.test.tsx`) di happy-dom.
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          environment: "node",
          include: ["src/**/*.test.ts"],
          name: "node",
        },
      },
      {
        extends: true,
        test: {
          environment: "happy-dom",
          include: ["src/**/*.test.tsx"],
          name: "dom",
        },
      },
    ],
  },
});
