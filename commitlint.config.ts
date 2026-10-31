import type { UserConfig } from "@commitlint/types";

// Scope opsional; bila diisi harus salah satu dari daftar ini (nama folder
// app/paket). apps/email memakai "email-preview" agar tidak bentrok dengan
// packages/email. Scope lintas repo: repo, deps, ci, docs, agents.
const scopes = [
  "api",
  "app",
  "web",
  "email-preview",
  "storybook",
  "env",
  "db",
  "auth",
  "core",
  "design-system",
  "data",
  "payments",
  "email",
  "storage",
  "phone",
  "analytics",
  "observability",
  "seo",
  "typescript-config",
  "e2e",
  "repo",
  "deps",
  "ci",
  "docs",
  "agents",
];

// Lebih ketat dari preset: tanpa "style" (format sudah otomatis lewat Oxfmt)
// dan tanpa "revert" (commit `Revert "..."` dari git tetap diabaikan commitlint).
const types = [
  "feat",
  "fix",
  "refactor",
  "perf",
  "test",
  "docs",
  "chore",
  "build",
  "ci",
];

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 72],
    "scope-enum": [2, "always", scopes],
    "type-enum": [2, "always", types],
  },
};

export default config;
