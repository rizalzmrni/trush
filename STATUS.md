# STATUS.md — Papan Status trush

Disunting HANYA oleh lead. Teammate melapor lewat pesan (format di `AGENTS.md`); lead memindahkan isinya ke sini. Status: `todo | wip | review | done | blocked`.

Terakhir diperbarui: 2026-10-31 · oleh lead · fase aktif: Fase 0

## Ringkasan per agent

### backend-engineer

- Sedang dikerjakan: —
- Selesai terakhir: B5 `apps/api` (+ pin Scalar); `VITE_SITE_URL` di `@trush/env` web
- Berikutnya: B4 `packages/db`
- Blocker: —

### frontend-engineer

- Sedang dikerjakan: —
- Selesai terakhir: F3b HSTS web; F3a `toAbsoluteUrl`; F3 `apps/web` + `packages/seo`
- Berikutnya: F4 `apps/app` (menunggu B6)
- Blocker: —

### qa-tester

- Sedang dikerjakan: —
- Selesai terakhir: Q6 (seo 54, web 29); Q1; Q5; Q4
- Berikutnya: Q2 (setelah B6, F4)
- Blocker: —

## Backlog bootstrap

| ID | Tugas | Pemilik | Status | Bergantung |
| --- | --- | --- | --- | --- |
| L0 | Root: workspaces bun, `turbo.json`, `typescript-config`, Ultracite (`oxlint.config.mts`, `oxfmt.config.mts`), Husky + lint-staged + `commitlint.config.ts`, catalog bun, template PR | lead | done (PR #1) | — |
| L1 | CI GitHub Actions (check-types, check, test, commitlint judul PR) + ruleset `main` + akun bot agent | lead + manusia | wip (CI + bot `trush-app[bot]` done; ruleset `protect-main` belum lengkap: Code Owners review, squash-only, blokir hapus branch) | L0 |
| L2 | `DESIGN.md` + `packages/design-system/components.json` | lead + manusia | done | — |
| L3 | Deploy manual staging ke `*.workers.dev` (`wrangler.jsonc` `env.staging`) | manusia | todo | B5, F3 |
| L4 | Domain + `deploy.yml` (staging otomatis, produksi manual) | lead + manusia | todo | L3 |
| L5 | Environment GitHub `e2e` (secret `NEON_API_KEY`, variable `NEON_PROJECT_ID`) untuk `e2e.yml` | manusia | wip (secret diisi 2026-10-31; branch Neon `dev` dibuat sebagai parent `e2e.yml`; job tetap merah sampai B4 + Q3) | Q3 |
| L6 | Atur retensi PITR Neon produksi + uji pemulihan pertama (`docs/environments.md`) | manusia | todo | L4 |
| B1 | `packages/env`: factory web/app/api + `.dev.vars.example` | backend-engineer | done (PR #2) | L0 |
| B2 | `packages/core`: kerangka + skema Zod awal | backend-engineer | done (PR #2) | L0 |
| B3 | `packages/observability`: logger LogTape + redaksi + sink BetterStack | backend-engineer | done (PR #3) | B1 |
| B4 | `packages/db`: factory klien Neon, `newId()` UUIDv7, skema awal, migrasi pertama | backend-engineer | todo | B1 |
| B5 | `apps/api`: `OpenAPIHono`, `/health`, `/openapi.json`, Scalar `/docs`, `@trush/api/client` | backend-engineer | done (PR #4) | B1, B3 |
| B6 | `packages/auth` (plugin sesuai daftar izin, termasuk `captcha`) + `/api/auth/*`, `/api/me`, `/api/me/organizations` | backend-engineer | todo | B4, B5 |
| B7 | `packages/phone` (driver `memory`/`log`/`twilio-test`/`twilio`) + `sendOTP` plugin `phoneNumber` + rate limit OTP | backend-engineer | todo | B1, B6 |
| B8 | `APP_ENV` + guard kombinasi production di `@trush/env`; driver `memory` email saat `E2E=true`; route `/__e2e/outbox` | backend-engineer | todo | B1, B7 |
| F1 | `packages/design-system`: `globals.css` kanonik dari `DESIGN.md`, `DesignSystemProvider` (next-themes + Toaster), font Outfit, `cn`, `lib/format`, komponen `feedback/` | frontend-engineer | done (PR #2) | L0, L2 |
| F2 | `apps/storybook` memuat design-system | frontend-engineer | done (PR #3) | F1 |
| F1a | Perbaiki `formatCurrency`: IDR + `minimumFractionDigits` > 0 melempar RangeError (bug dari Q4, `it.fails` di `format.test.ts`) | frontend-engineer | done (PR #3) | F1, Q4 |
| F3 | `apps/web`: kerangka SSR + `packages/seo` dasar | frontend-engineer | done (PR #4) | F1, B1 |
| F3a | `toAbsoluteUrl` menolak path yang berpindah origin (`/	/…`, `/\…`; bug Q6) | frontend-engineer | done (PR #4) | F3, Q6 |
| F3b | HSTS `apps/web` hanya production di domain resmi (bukan localhost/`*.workers.dev`), seperti api (bug Q6) | frontend-engineer | done (PR #4) | F3, Q6 |
| F3c | `typegen` web deterministik (`wrangler types --env-file .dev.vars.example`; CI PR #4 merah karena `.dev.vars` lokal) | frontend-engineer | done (PR #4) | F3 |
| B5a | `typegen` api memakai pola yang sama | backend-engineer | done (PR #4) | B5 |
| F4 | `apps/app`: kerangka SSR, Service Binding `API`, `api-client.ts`, `requireSession`, widget Turnstile di form auth | frontend-engineer | todo | F1, B6 |
| Q1 | Test env, core, api `/health` | qa-tester | done (env, core PR #3; `/health` + fixture `VITE_SITE_URL` PR #4; validasi 400 diuji di Q2/B6) | B1, B2, B5 |
| Q2 | Test alur auth (api) + guard (app) | qa-tester | todo | B6, F4 |
| Q3 | Workspace `e2e/` + alur kritis (daftar, login + OTP, auth gate, logout) | qa-tester | todo | F4, B8 |
| Q4 | Test design-system: `lib/format` (id-ID, zona waktu) + komponen `feedback/` (role/label, keyboard, state) | qa-tester | done (PR #3) | F1 |
| Q6 | Test `packages/seo` (meta/canonical/robots) + smoke SSR `apps/web` (render root, error boundary) | qa-tester | done (PR #4) | F3 |
| Q5 | Test observability: redaksi (termasuk bersarang), bentuk JSON, `requestId` di setiap log, sink BetterStack gagal tidak melempar, guard level production | qa-tester | done (PR #3) | B3 |

Catatan lanjutan dari batch ini:

- F4: naikkan `ErrorPage` (`apps/web/src/features/errors`) ke `@trush/design-system` `components/feedback` + story.
- `apps/web` `entry.server.tsx` `onError` belum melaporkan error ke mana pun; sambungkan saat analytics/observability web dikerjakan.
- `@trush/seo`: sitemap + JSON-LD saat ada halaman marketing nyata.
- Q3: blok `env.e2e` di `wrangler.jsonc` web (dan api di B8).
- L3/L4: ganti placeholder `CORS_ORIGINS` di `apps/api/wrangler.jsonc`; sediakan `VITE_SITE_URL`/`VITE_APP_URL`/`VITE_APP_ENV` saat `CLOUDFLARE_ENV=… vite build`.
- `typegen` semua app memakai `wrangler types --env-file .dev.vars.example`: setiap var/secret baru WAJIB masuk `.dev.vars.example` agar ada di tipe `Env` (F4 `apps/app` ikut pola ini).
- Regex `NON_OFFICIAL_HOST` kini disalin di `apps/api` dan `apps/web`; bila F4 butuh salinan ketiga, pindahkan ke paket bersama (usulan: `@trush/core`).
- Naikkan `SCALAR_BUNDLE_URL` (`apps/api/src/middleware/security.ts`) bersamaan dengan `@scalar/hono-api-reference`.

Fase berikutnya (belum dipecah): payments, email + `apps/email`, storage, analytics.

## Kontrak lintas-wilayah (`packages/core`)

| Kontrak | Penulis | Dipakai oleh | Status |
| --- | --- | --- | --- |
| `ErrorResponse` (`@trush/core/schemas/error`): `{ error: { code, message, details? } }` | backend-engineer | `apps/api` (onError, defaultHook), klien `apps/app`/`apps/web` | done (B2) |
| `HealthResponse` (`@trush/core/schemas/health`): `{ status: "ok" }` | backend-engineer | `apps/api` `GET /health` (B5), Q1 | done (B2) |
| `@trush/api/client`: `hcWithType`, `Client`, `AppType` (tipe dari `dist/types`, `build:types`) | backend-engineer | `apps/app`, `apps/web` | done (B5) |

## Blocker aktif

- —

## Log (terbaru di atas)

- 2026-10-31 — PR #4 di-merge ke `main`. L1 done: git/gh agent kini memakai GitHub App `trush-app[bot]` (token lokal, di luar repo), jadi PR dibuat bot dan `rizalzmrni` dapat approve sebagai CODEOWNER. PR ini PR pertama dari bot.
- 2026-10-31 — L5: `e2e` PR #5 gagal di langkah "Buat branch Neon sementara" karena branch parent `dev` tidak ada (hanya `production`). Branch Neon `dev` dibuat dari `production`.
- 2026-10-31 — L1 dibuka lagi: ruleset `protect-main` belum mewajibkan review Code Owners, masih mengizinkan merge/rebase, dan belum memblokir penghapusan `main`. Sampai diperbaiki, prasyarat merge oleh lead (`docs/pull-requests.md` bagian 0) belum terpenuhi; manusia yang merge.
- 2026-10-31 — PR #4 siap merge (B5, B5a, F3, F3a, F3b, F3c, Q1 `/health`, Q6 done). CODEOWNERS diperbaiki ke `oxlint.config.mts`/`oxfmt.config.mts`. L5 wip: secret Neon diisi; `e2e` (bukan check wajib) tetap merah sampai `@trush/db` (B4), `e2e/scripts/write-dev-vars.ts`, dan test Q3 ada. PR #4 dibuat dari akun manusia, jadi approval CODEOWNERS tidak bisa diberikan author; akun bot agent (L1) masih belum ada.
- 2026-10-31 — CI PR #4 merah: tipe `Env` dari `wrangler types` membaca `.dev.vars` lokal, berbeda dengan CI. F3c + B5a (`fix(web)`, `fix(api)`): typegen dari `.dev.vars.example`. Check `e2e` tetap merah sampai L5 (secret Neon).
- 2026-10-31 — F3b done (`fix(web)`): HSTS web hanya production di domain resmi, test regresi per host. Batch `feat/fase0-api-web` ditutup: PR #4 (Draft).
- 2026-10-31 — Q6 done (`test(web)`): 54 test seo + 29 test web; `@testing-library/react` + `/dom` (catalog:test) di apps/web. Bug Q6: F3a (`toAbsoluteUrl` keluar origin lewat tab/newline/backslash) done (`fix(seo)`); F3b (HSTS web tanpa cek host) wip.
- 2026-10-31 — F3 done (`feat(web)`): SSR React Router 8.5.1 di Workers, CSP nonce per request, tanpa `isbot` (render penuh), `@trush/seo` `./meta` + `./robots`. `VITE_SITE_URL` di-commit bersama fixture (`feat(env)`). Q1 done: 53 test api (`test(api)`). Scalar di-pin 1.76.3 (`fix(api)`). Q6 wip.
- 2026-10-31 — B5 done (`feat(api)`): `.meta({ id })` Zod 4 terbukti dibaca `@hono/zod-openapi` 1.6.3 (komponen ber-`$ref`); tipe `node:async_hooks` lewat deklarasi ambient minimal `apps/api/src/async-hooks.d.ts`; header `x-request-id`; `/docs` + `/openapi.json` 404 di luar development kecuali `API_DOCS_ENABLED`. `worker-configuration.d.ts` di-ignore (dibuat ulang oleh `typegen`). `CORS_ORIGINS` staging/production masih placeholder (L3/L4). Env web baru `VITE_SITE_URL` (wajib).
- 2026-10-31 — PR #3 di-merge. Batch `feat/fase0-api-web`: B5 dan F3 wip; Q1 `/health` menunggu B5; Q6 (test web + seo) ditambahkan, menunggu F3.
- 2026-10-31 — Q5 done (29 test observability + 6 kasus env BetterStack). Batch `feat/fase0-observability-storybook` ditutup: PR #3 (Draft).
- 2026-10-31 — B3 done (`feat(observability)`): `AsyncLocalStorage` disuntik pemanggil (opsi A, tipe `node:async_hooks` diputuskan di B5). Env api baru: `BETTERSTACK_INGEST_URL` + `BETTERSTACK_SOURCE_TOKEN` (opsional, berpasangan). Format ingest BetterStack dicek ke dokumentasi resmi. Q5 ditambahkan.
- 2026-10-31 — Q4 done (66 test design-system, termasuk keyboard via user-event). F1a done: bug `formatCurrency` IDR dari Q4 diperbaiki.
- 2026-10-31 — F2 done (`feat(storybook)`): import `@trush/design-system/...` ter-resolve di Vite; telemetri Storybook dimatikan. Q1 bagian env + core done (`test(env)`). Catalog: `@storybook/addon-a11y` 10.6.5, `@testing-library/user-event`.
- 2026-10-31 — PR #2 di-merge. Batch `feat/fase0-observability-storybook`: B3, F2, Q4 wip; Q1 dimulai untuk env + core (`/health` menunggu B5). qa-tester di-spawn.
- 2026-10-31 — Batch `feat/fase0-foundation` ditutup: PR #2 (B1, B2, F1) dibuka sebagai Draft.
- 2026-10-31 — B2 done (`feat(core)`): kontrak `ErrorResponse` dan `HealthResponse`. B5 wajib memastikan `@hono/zod-openapi` membaca `.meta({ id })` Zod 4.
- 2026-10-31 — B1 done (`feat(env)`), F1 done (`feat(design-system)`). Catalog `ui`: `cn` + `@fontsource/outfit` (Outfit self-host, tanpa ADR); `clsx`/`tailwind-merge` dihapus. Q4 ditambahkan. B2 wip.
- 2026-10-31 — PR #1 (L0) di-merge. Ruleset `main` dibuat manusia (L1 wip: CI wajib dan akun bot belum dikonfirmasi). Batch `feat/fase0-foundation`: B1 dan F1 wip.
- 2026-10-31 — L0 done (PR #1, branch `chore/l0-root-bootstrap`): workspaces bun + catalog, `turbo.json`, `@trush/typescript-config` (`base`, `react`), Ultracite (Oxlint + Oxfmt), Husky + lint-staged + commitlint, `.gitattributes` LF. Kerangka `e2e/package.json` dibuat lead; selanjutnya milik qa-tester.
- {{YYYY-MM-DD}} — Plugin `captcha` (Turnstile) diizinkan; aturan layanan pihak ketiga + ADR 0002.
- {{YYYY-MM-DD}} — Review: `CLOUDFLARE_ENV`, lingkungan lokal `e2e`, `VITE_APP_ENV`, rate limit better-auth, security headers, backup, README.
- {{YYYY-MM-DD}} — Aturan lingkungan (`docs/environments.md`) dan setup e2e Playwright ditetapkan.
- {{YYYY-MM-DD}} — Penyedia SMS/WhatsApp: Twilio Messaging (ADR 0001).
- {{YYYY-MM-DD}} — `DESIGN.md` dan `components.json` ditetapkan (L2 done).
- {{YYYY-MM-DD}} — STATUS.md dibuat; backlog bootstrap disusun.
