// Ekstensi file mengikuti hasil `bunx ultracite init` (.ts atau .mts).
import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    ".agents/skills/**",
    ".claude/skills/**",
    "packages/design-system/src/components/ui/**",
    // Hasil drizzle-kit (SQL + snapshot JSON): diformat ulang akan memicu
    // diff palsu setiap `db:generate`.
    "packages/db/drizzle/**",
  ],
});
