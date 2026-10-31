import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import drizzle from "ultracite/oxlint/drizzle";
import playwright from "ultracite/oxlint/playwright";
import react from "ultracite/oxlint/react";
import remix from "ultracite/oxlint/remix";
import storybook from "ultracite/oxlint/storybook";
import tanstack from "ultracite/oxlint/tanstack";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  env: core.env,
  extends: [
    core,
    react,
    vitest,
    storybook,
    playwright,
    drizzle,
    tanstack,
    remix,
  ],
  ignorePatterns: [
    ...core.ignorePatterns,
    // Komponen shadcn/ui hasil generator: tidak di-lint.
    "packages/design-system/src/components/ui/**",
    // Skill agent bukan kode produk.
    ".agents/skills/**",
    ".claude/skills/**",
  ],
  overrides: [
    {
      // Urutan kolom Drizzle = urutan kolom tabel; jangan diurutkan alfabet.
      files: ["packages/db/src/schema/**"],
      rules: { "sort-keys": "off" },
    },
    {
      // Test e2e Playwright memakai pola fixture kosong:
      // test.beforeEach(async ({}, testInfo) => ...).
      files: ["e2e/**/*.ts"],
      rules: {
        "no-empty-pattern": [
          "error",
          { allowObjectPatternsAsParameters: true },
        ],
      },
    },
    {
      // Satu-satunya tempat console boleh dipakai: sink logger dan test-nya.
      files: [
        "packages/observability/src/logger.ts",
        "packages/observability/src/logger.test.ts",
      ],
      rules: { "no-console": "off" },
    },
  ],
  rules: {
    // Preset core mematikan no-console; trush menyalakannya.
    "no-console": "error",
  },
});
