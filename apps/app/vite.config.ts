import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const DEV_PORT = 5174;

export default defineConfig({
  // React Router 8 mengosongkan optimizeDeps.entries (kecuali
  // future.unstable_optimizeDeps), sehingga scanner Vite hanya mem-bundle
  // react/react-dom/react-router. Dependensi klien lain baru ditemukan saat
  // muat pertama, lalu Vite me-reload halaman dan chunk lama dibalas 504
  // "Outdated Optimize Dep": hydration gagal pada muat pertama setelah cache
  // dingin (e2e CI). Entri eksplisit membuat semuanya di-bundle saat start.
  optimizeDeps: {
    entries: ["src/root.tsx", "src/routes/**/*.tsx", "!src/**/*.test.tsx"],
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
  ],
  server: {
    port: DEV_PORT,
    strictPort: true,
  },
});
