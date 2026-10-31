# trush — Monorepo SaaS (CLAUDE.md root)

Boilerplate SaaS: Turborepo + bun, TypeScript strict; `apps/web`, `apps/app`, `apps/api` berjalan di Cloudflare Workers. File ini memuat aturan global untuk SELURUH repo. Aturan khusus paket ada di `CLAUDE.md` paket itu, dimuat otomatis saat kamu membuka file di folder tersebut.

@AGENTS.md

## Urutan bootstrap (lead)

- Sebelum teammate di-spawn untuk task apa pun, lead menyelesaikan L0: `turbo.json`, `packages/typescript-config`, workspaces (`apps/*`, `packages/*`, `e2e`) di `package.json` root, konfigurasi Ultracite, Husky + commitlint. Alasan: semua paket bergantung pada pipeline dan preset tsconfig ini.
- `turbo.json`: task `build`, `dev` (`persistent: true`, `cache: false`), `check-types`, `check`, `test`, `test:e2e` (`cache: false`, terpisah dari `test`), `typegen`, `build:types`. `check-types` bergantung pada `typegen` dan `^build:types`; `outputs` eksplisit; env yang memengaruhi build (termasuk `CLOUDFLARE_ENV` dan `VITE_*`) didaftarkan di `env`; task `dev` meneruskan `CLOUDFLARE_ENV` lewat `passThroughEnv`.
- `packages/typescript-config`: `base.json` (`strict`, `moduleResolution: "bundler"`, `noUncheckedIndexedAccess`) dan `react.json` (extends base + JSX).

## Package manager & monorepo

- **bun satu-satunya package manager.** `npm`, `npx`, `pnpm`, `yarn` dilarang (diblokir di `.claude/settings.json`); lockfile selain `bun.lock` ditolak.
- Task lewat script root yang memanggil Turborepo: `bun run build`, `dev`, `check-types`, `check` (Ultracite), `fix`, `test`, `test:e2e`. Satu paket: `bunx turbo run test --filter=@trush/db`.
- Impor antar paket selalu lewat nama workspace `@trush/<nama>`, tidak pernah path relatif lintas folder. Alasan: batas paket harus eksplisit.
- `apps/*` tidak saling impor, kecuali klien RPC bertipe `@trush/api/client` (lihat `docs/react-router.md`). Kode bersama naik ke `packages/*`.
- Dependensi baru diminta ke lead dan dipasang mengikuti `docs/dependencies.md` (bun catalog), karena `bun.lock` dipakai bersama.

## Layanan pihak ketiga

- Layanan eksternal baru (SaaS, API berbayar, SDK yang mengirim data ke luar) hanya lewat ADR di `docs/adr/` yang disetujui user, memakai `docs/adr/0000-template.md`. Teammate tidak menambahkannya sendiri; usulkan ke lead.
- Urutan pertimbangan: (1) fitur stack yang sudah ada, (2) layanan native Cloudflare (WAF, Turnstile, Rate Limiting, Durable Objects, Queues, Cron Triggers, R2), (3) vendor eksternal.
- Layanan yang sudah diputuskan tidak dipakai tercatat di `docs/adr/0002-third-party-services.md`.

## TypeScript

- Extend `@trush/typescript-config` (`base` atau `react`); tanpa `any` implisit.
- `@types/node` / `@types/bun` tidak masuk tsconfig kode Worker atau browser; tipe Worker berasal dari `bunx wrangler types`.
- Bila terpaksa, `@ts-expect-error` + alasan di baris yang sama; `@ts-ignore` dilarang.

## Env & secret

- Lingkungan hanya ditentukan oleh `APP_ENV` (`development | staging | production`); aturan tiap lingkungan di `docs/environments.md`.
- Env hanya dibaca lewat factory `@trush/env`. Kode app tidak menyentuh `process.env` / `import.meta.env` selain untuk meneruskannya ke factory itu. Alasan: di Workers env datang dari binding per request (`c.env`, `getCloudflare(context).env`), bukan saat modul dimuat.
- Secret tidak di-commit, tidak di-log, tidak masuk bundel klien. Secret lokal di `.dev.vars`; contohnya di `.dev.vars.example`. `.gitignore` wajib memuat `.env*` (kecuali `.env.example`) dan `.dev.vars`.

## Runtime: Cloudflare Workers

- `compatibility_date` sama di semua `wrangler.jsonc` dan minimal `2026-08-04`, sehingga Node.js compat aktif otomatis tanpa flag. Tetap utamakan Web API.
- Binding (R2, var, secret) dideklarasikan di `wrangler.jsonc`; tipe `Env` dihasilkan dengan `bunx wrangler types`, tidak ditulis tangan.
- Pekerjaan setelah respons (kirim log, analytics) dibungkus `ctx.waitUntil()`; promise mengambang dibatalkan runtime.

## Lint & format (Ultracite: Oxlint + Oxfmt)

- `bun run check` harus bersih (`bun run fix` untuk memperbaiki). Konfigurasi ada di `oxlint.config.mts` dan `oxfmt.config.mts` root, milik lead. Teammate tidak mengubahnya dan tidak menambah komentar `oxlint-disable` tanpa persetujuan lead.
- Pengecualian yang berlaku (di luar ini semua rule aktif):
  - `sort-keys` mati di `packages/db/src/schema/**`, karena urutan kolom bermakna.
  - `no-console` AKTIF di seluruh repo (preset Ultracite mematikannya, trush menyalakannya), kecuali `packages/observability/src/logger.ts` dan `logger.test.ts`. Di tempat lain pakai logger `@trush/observability` (server) atau pelaporan error `@trush/analytics` (klien).
  - `packages/design-system/src/components/ui/**` tidak di-lint dan tidak di-format (hasil `bunx shadcn@latest add`). Boleh disesuaikan, tanpa logika bisnis, dan wajib direview manual.
  - `.agents/skills/**` dan `.claude/skills/**` tidak di-format dan tidak di-lint.
  - `packages/db/drizzle/**` (hasil `drizzle-kit`) tidak di-format, agar `db:generate` tidak memicu diff format.

## Struktur folder & pengelompokan

- Bila satu folder berisi **4 file sumber atau lebih** yang berkaitan (fitur, domain, atau prefix nama yang sama), pindahkan ke subfolder bernama fitur tersebut (kebab-case). Alasan: folder datar cepat berantakan.
- Hitung hanya file sumber. Pendamping (`*.test.*`, `*.stories.*`) diletakkan di samping sumbernya dan tidak ikut dihitung.
- Kelompokkan per fitur/domain, bukan per jenis file. Hindari folder `utils/` atau `hooks/` raksasa lintas fitur.
- Nama file tidak mengulang nama folder: `billing/invoice-list.tsx`, bukan `billing/billing-invoice-list.tsx`.
- Jangan membuat folder berisi satu file, dan maksimal 4 level di bawah `src/`.
- Tanpa `index.ts` barrel hanya untuk pengelompokan; impor langsung dari path file. Entry paket (`src/index.ts`) tetap boleh.
- Dikerjakan saat file ke-4 ditambahkan, oleh pemilik wilayah, dalam task yang sama, beserta pembaruan semua impor.
- Pengecualian (struktur ditentukan alat): `components/ui/` shadcn, folder migrasi Drizzle, file hasil generate, file konfigurasi di root app/paket.

## Kualitas & git

- Branch dan commit mengikuti `docs/git.md`; pull request mengikuti `docs/pull-requests.md`. `--no-verify` dilarang.
- Test: Vitest. Paket Workers memakai `@cloudflare/vitest-plugin`, pengganti `@cloudflare/vitest-pool-workers` sejak Agustus 2026. Jangan pasang paket lama.
- E2E: Playwright di workspace `e2e/` (lihat `e2e/CLAUDE.md`).

## Definisi Selesai (global)

1. `check-types`, `check`, dan `test` paket terdampak hijau (ditegakkan hook `TaskCompleted`).
2. Env baru terdaftar di `@trush/env` dan `.dev.vars.example`.
3. Laporan akhir tugas terkirim ke lead (format di AGENTS.md); lead memperbarui `STATUS.md`.
4. Tugas UI: daftar periksa di akhir `DESIGN.md` terpenuhi.

## Stack (ringkas)

React Router framework mode (SSR) + Vite + `@cloudflare/vite-plugin` · Hono + `@hono/zod-openapi` + Scalar · Neon Postgres + Drizzle · Zod + t3-env · Tailwind + shadcn/ui · better-auth · Polar · Resend + React Email · Cloudflare R2 · Twilio (SMS/WhatsApp) · TanStack Query/Table/Form · GA + PostHog · LogTape → Workers Logs + BetterStack.

## Rujukan

- `AGENTS.md`: tim agent, wilayah, alur kerja (diimpor di atas).
- `STATUS.md`: posisi pekerjaan terkini; baca di awal setiap sesi.
- `DESIGN.md`: token, komponen, state data, dan daftar periksa UI; baca sebelum tugas UI.
- `docs/`: `git.md`, `pull-requests.md`, `dependencies.md`, `react-router.md`, `hono-api.md`, `auth-plugins.md`, `environments.md`, `adr/` (catatan keputusan).
