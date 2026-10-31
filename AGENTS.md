<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# AGENTS.md — Tim Agent trush

Cara menjalankan pekerjaan trush sebagai agent team Claude Code. File ini diimpor oleh `CLAUDE.md` root, jadi termuat di lead dan setiap teammate. Rujukan utama (selalu ikuti): https://code.claude.com/docs/en/agent-teams

## Peran & wilayah

| Agent | Wilayah tulis |
| --- | --- |
| lead (sesi utama) | Koordinasi, pecah tugas, review, commit. Pemilik `turbo.json`, `package.json` root, `bun.lock`, `packages/typescript-config`, `oxlint.config.mts`, `oxfmt.config.mts`, `commitlint.config.ts`, `.lintstagedrc.json`, `.husky/`, `.gitignore`, `.mcp.json`, `README.md`, `CLAUDE.md` root, `AGENTS.md`, `DESIGN.md`, `STATUS.md`, `.claude/`, `.github/`, `docs/`. |
| backend-engineer | `apps/api`; `packages/` `db`, `auth`, `core`, `env`, `payments`, `phone`, `email`, `storage`, `observability`. |
| frontend-engineer | `apps/` `web`, `app`, `storybook`, `email`; `packages/` `design-system`, `data`, `seo`, `analytics`. |
| qa-tester | Hanya file test di paket mana pun: `*.test.*`, `*.spec.*`, `test/`, seluruh workspace `e2e/` (termasuk `playwright.config.ts`), dan `src/testing/` di apps (setup, fixture, mock). Entry `testing` yang diekspor paket (mis. `@trush/db/testing`) milik pemilik paket. |

- Semua agent boleh MEMBACA seluruh repo.
- `vitest.config.*` milik pemilik paket (konfigurasi build), bukan qa-tester.
- `CLAUDE.md` paket: pemilik paket boleh menambah aturan/jebakan, lead meninjau. `CLAUDE.md` root dan `AGENTS.md` hanya diubah lead.

Definisi peran ada di `.claude/agents/*.md` dan dipakai ulang sebagai teammate maupun subagent.

## Alat (tools) & fokus

Field `tools` di definisi agent membatasi JENIS alat, bukan path file. Semua agent memegang alat baca (`Read`, `Grep`, `Glob`) ke seluruh repo agar tidak kehilangan konteks kontrak & aturan root. Fokus wilayah ditegakkan lewat aturan kepemilikan + review lead + hook, bukan dengan mencabut alat tulis.

## Mengaktifkan tim

`.claude/settings.json` sudah menyetel `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Tim hanya terbentuk di sesi interaktif (bukan `-p` / Agent SDK). Mode tampilan (`teammateMode`) diatur tiap developer di `~/.claude/settings.json`.

## Aturan koordinasi

- Satu file, satu pemilik. Tugas lintas-wilayah dipecah per pemilik oleh lead, lengkap dengan dependensi.
- Kontrak dulu: skema Zod / tipe response ditulis backend di `packages/core` sebagai task pertama yang memblokir task frontend & backend lain.
- Teammate saling kirim pesan langsung memakai nama (`backend-engineer`, `frontend-engineer`, `qa-tester`). Butuh perubahan di wilayah lain? Kirim pesan ke pemiliknya, jangan sunting sendiri.
- Git hanya oleh lead. Teammate dilarang `git commit`, `push`, `checkout`, `stash`, `reset`, `rebase`. Alasan: satu working tree dipakai bersama, perintah itu menimpa pekerjaan agent lain. Ditegakkan hook `PreToolUse` (`.claude/hooks/guard-git.ts`).
- Dependensi: teammate mengirim permintaan ke lead (paket, alasan, workspace tujuan, usulan catalog sesuai `docs/dependencies.md`); lead menjalankan `bun add` supaya `bun.lock` tidak ditulis bersamaan.
- Teammate tidak mewarisi riwayat percakapan lead. Lead wajib menyertakan konteks tugas di prompt spawn.

## Bug dari qa-tester

1. qa-tester menulis test reproduksi sebagai `test.fails(...)` dengan komentar `// BUG: <ringkas>`, supaya suite tetap hijau.
2. qa-tester mengirim pesan ke pemilik file: test, langkah reproduksi, perilaku yang diharapkan; lalu membuat task perbaikan untuk pemilik itu.
3. Pemilik memperbaiki kode lalu mengubah `test.fails` menjadi `test`.

## Alur kerja satu tugas

1. Lead membaca `STATUS.md`, membuat branch batch (lihat `docs/git.md`) sebelum spawn, lalu membuat task (1 task = 1 deliverable; 5–6 task per teammate) dan menyetel dependensi.
2. Engineer mengerjakan task di wilayahnya.
3. qa-tester mengambil task test setelah task implementasinya `done`.
4. Saat task ditandai selesai, hook `TaskCompleted` menjalankan `check-types`, `check`, dan `test` paket terdampak. Gagal berarti task ditolak dan agent lanjut bekerja.
5. Teammate mengirim laporan akhir; lead review, commit per task (hanya file di laporan), dan memperbarui `STATUS.md` di branch yang sama.

## Format laporan akhir (teammate ke lead)

```
Tugas: <judul task>
Selesai: <1–3 poin hasil>
File diubah: <daftar path>
Kontrak/env baru: <— atau rincian>
Dependensi: <— atau paket + catalog + alasan>
Berikutnya: <usulan langkah lanjut>
Blocker: <— atau rincian + siapa yang ditunggu>
```

## Pull request

Hanya lead (atau developer manusia) yang membuat dan merge PR. Sebelum membuat PR, lead membuka `docs/pull-requests.md` dan mengikutinya; merge oleh lead hanya setelah prasyarat di bagian 0 file itu terpenuhi. Teammate tidak membuat branch atau PR; laporan akhirnya menjadi bahan deskripsi PR.

## STATUS.md

Hanya lead yang menyunting, untuk mencegah tabrakan edit. Diperbarui setiap task berpindah status. `/resume` tidak memulihkan teammate in-process; setelah resume, lead membaca `STATUS.md` lalu spawn ulang teammate.

## Template prompt spawn (untuk lead)

> Spawn tiga teammate memakai definisi agent `backend-engineer`, `frontend-engineer`, `qa-tester`; beri nama sama dengan tipenya. Tugas: {{deskripsi_fitur}}. Task terkait di STATUS.md: {{id_task}}. Patuhi wilayah di AGENTS.md dan kirim laporan akhir sesuai formatnya.

## Memelihara CLAUDE.md

- Tulis nama paket ber-`@` (mis. `@trush/env`) di dalam backtick. `@path` di luar backtick dibaca Claude Code sebagai impor file.
- `CLAUDE.md` paket: 20–60 baris, ikuti template, jangan ulangi aturan root.

## Catatan

- Mulai dengan 3 teammate; tambah hanya bila pekerjaan benar-benar paralel.
- Izin perintah umum sudah di-allow di `.claude/settings.json` agar prompt izin tidak menumpuk di lead.

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bunx ultracite fix`
- **Check for issues**: `bunx ultracite check`
- **Diagnose setup**: `bunx ultracite doctor`

Oxlint + Oxfmt (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns
- Avoid import cycles; move shared code into a module both sides import

### Security

- Add `rel="noopener noreferrer"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt will catch most mechanical issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `bunx ultracite fix` before committing to ensure compliance.
