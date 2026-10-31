import { defineConfig } from "vitest/config";

// Tiap `createTestDb()` memuat WASM PGlite + menerapkan migrasi (~1-3 detik,
// lebih lama saat turbo menjalankan task paralel); default 5 detik terlalu ketat.
const PGLITE_TIMEOUT_MS = 30_000;

export default defineConfig({
  test: {
    environment: "node",
    hookTimeout: PGLITE_TIMEOUT_MS,
    testTimeout: PGLITE_TIMEOUT_MS,
  },
});
