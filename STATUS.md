# STATUS.md — Papan Status trush

Disunting HANYA oleh lead. Teammate melapor lewat pesan (format di `AGENTS.md`); lead memindahkan isinya ke sini. Status: `todo | wip | review | done | blocked`.

Terakhir diperbarui: 2026-11-01 · oleh lead · fase aktif: Fase 0

## Ringkasan per agent

### backend-engineer

- Sedang dikerjakan: —
- Selesai terakhir: B7a (temuan keamanan PR #10: login OTP mati, `phoneNumber` di sign-up ditolak, driver `log`/`memory` hanya development); B7; B6
- Berikutnya: B8 (`APP_ENV` guard production, driver `memory` saat `E2E=true`, `/__e2e/outbox`); B7b, B7c (lanjutan keamanan OTP telepon)
- Blocker: —

### frontend-engineer

- Sedang dikerjakan: —
- Selesai terakhir: F4a (open redirect `getSafeRedirect` + vitest node/happy-dom); F4 `apps/app`; F3b
- Berikutnya: fase berikutnya belum dipecah
- Blocker: —

### qa-tester

- Sedang dikerjakan: —
- Selesai terakhir: Q9 (31 repro temuan keamanan PR #10, kini lulus); Q2b (app 163, tanpa bug); Q8 (test phone, env phone, OTP auth); Q2a (auth 29, api 76, core 37)
- Berikutnya: Q3 e2e (setelah B8)
- Blocker: —

## Backlog bootstrap

| ID | Tugas | Pemilik | Status | Bergantung |
| --- | --- | --- | --- | --- |
| L0 | Root: workspaces bun, `turbo.json`, `typescript-config`, Ultracite (`oxlint.config.mts`, `oxfmt.config.mts`), Husky + lint-staged + `commitlint.config.ts`, catalog bun, template PR | lead | done (PR #1) | — |
| L1 | CI GitHub Actions (check-types, check, test, commitlint judul PR) + ruleset `main` + akun bot agent | lead + manusia | done (CI, ruleset `protect-main` lengkap, bot `trush-app[bot]`) | L0 |
| L2 | `DESIGN.md` + `packages/design-system/components.json` | lead + manusia | done | — |
| L3 | Deploy manual staging ke `*.workers.dev` (`wrangler.jsonc` `env.staging`) | manusia | todo | B5, F3 |
| L4 | Domain + `deploy.yml` (staging otomatis, produksi manual) | lead + manusia | todo | L3 |
| L5 | Environment GitHub `e2e` (secret `NEON_API_KEY`, variable `NEON_PROJECT_ID`) untuk `e2e.yml` | manusia | wip (secret diisi 2026-10-31; branch Neon `dev` dibuat sebagai parent `e2e.yml`; job tetap merah sampai B4 + Q3) | Q3 |
| L6 | Atur retensi PITR Neon produksi + uji pemulihan pertama (`docs/environments.md`) | manusia | todo | L4 |
| B1 | `packages/env`: factory web/app/api + `.dev.vars.example` | backend-engineer | done (PR #2) | L0 |
| B2 | `packages/core`: kerangka + skema Zod awal | backend-engineer | done (PR #2) | L0 |
| B3 | `packages/observability`: logger LogTape + redaksi + sink BetterStack | backend-engineer | done (PR #3) | B1 |
| B4 | `packages/db`: factory klien Neon, `newId()` UUIDv7, skema awal, migrasi pertama | backend-engineer | done (PR #8; infra saja, tabel auth di B6) | B1 |
| B4a | `@trush/env/db` menolak URL tak valid sebagai issue (bukan TypeError berisi nilai mentah); tsconfig test Node di db (bug Q7) | backend-engineer | done (PR #8) | B4, Q7 |
| B5 | `apps/api`: `OpenAPIHono`, `/health`, `/openapi.json`, Scalar `/docs`, `@trush/api/client` | backend-engineer | done (PR #4) | B1, B3 |
| B6 | `packages/auth` (plugin sesuai daftar izin, termasuk `captcha`) + `/api/auth/*`, `/api/me`, `/api/me/organizations` | backend-engineer | done (PR #9; tanpa `phoneNumber`→B7, `emailOTP`/`polar`→fase email/payments; verifikasi email belum wajib) | B4, B5 |
| B7 | `packages/phone` (driver `memory`/`log`/`twilio-test`/`twilio`) + `sendOTP` plugin `phoneNumber` + rate limit OTP | backend-engineer | done (OTP sinkron, nomor tak terdaftar tidak dikirimi OTP; rate limit `/phone-number/*` 3/menit per IP; lanjutan di B7b, B7c) | B1, B6 |
| B7a | Perbaiki temuan review keamanan PR #10: login OTP lewat `verify` melewati 2FA (High), `phoneNumber` di sign-up tanpa OTP (Medium), driver `log`/`memory` di staging (Low) | backend-engineer | done | B7, Q9 |
| B7b | `/phone-number/request-password-reset` tidak membedakan nomor terdaftar lewat waktu respons (samakan jalur nomor tak terdaftar, mis. kerja tiruan/penundaan konstan) + test | backend-engineer | todo | B7a |
| B7c | Rate limit permintaan OTP per pengguna dan per nomor tujuan (bukan hanya per IP) untuk pengguna yang sudah login | backend-engineer | todo | B7a |
| B8 | `APP_ENV` + guard kombinasi production di `@trush/env`; driver `memory` email saat `E2E=true`; route `/__e2e/outbox` | backend-engineer | todo | B1, B7 |
| F4a | Open redirect `getSafeRedirect` lewat dot-segment (`/.//evil` → `//evil`) + varian halaman auth; vitest `apps/app` node/happy-dom | frontend-engineer | done | F4, Q9 |
| F1 | `packages/design-system`: `globals.css` kanonik dari `DESIGN.md`, `DesignSystemProvider` (next-themes + Toaster), font Outfit, `cn`, `lib/format`, komponen `feedback/` | frontend-engineer | done (PR #2) | L0, L2 |
| F2 | `apps/storybook` memuat design-system | frontend-engineer | done (PR #3) | F1 |
| F1a | Perbaiki `formatCurrency`: IDR + `minimumFractionDigits` > 0 melempar RangeError (bug dari Q4, `it.fails` di `format.test.ts`) | frontend-engineer | done (PR #3) | F1, Q4 |
| F3 | `apps/web`: kerangka SSR + `packages/seo` dasar | frontend-engineer | done (PR #4) | F1, B1 |
| F3a | `toAbsoluteUrl` menolak path yang berpindah origin (`/	/…`, `/\…`; bug Q6) | frontend-engineer | done (PR #4) | F3, Q6 |
| F3b | HSTS `apps/web` hanya production di domain resmi (bukan localhost/`*.workers.dev`), seperti api (bug Q6) | frontend-engineer | done (PR #4) | F3, Q6 |
| F3c | `typegen` web deterministik (`wrangler types --env-file .dev.vars.example`; CI PR #4 merah karena `.dev.vars` lokal) | frontend-engineer | done (PR #4) | F3 |
| B5a | `typegen` api memakai pola yang sama | backend-engineer | done (PR #4) | B5 |
| F4 | `apps/app`: kerangka SSR, Service Binding `API`, `api-client.ts`, `requireSession`, widget Turnstile di form auth | frontend-engineer | done (diuji Q2b, Q9) | F1, B6 |
| Q1 | Test env, core, api `/health` | qa-tester | done (env, core PR #3; `/health` + fixture `VITE_SITE_URL` PR #4; validasi 400 diuji di Q2/B6) | B1, B2, B5 |
| Q2 | Test alur auth (api) + guard (app) | qa-tester | done (Q2a PR #9; Q2b 163 test app, tanpa bug) | B6, F4 |
| Q3 | Workspace `e2e/` + alur kritis (daftar, login + OTP, auth gate, logout) | qa-tester | todo | F4, B8 |
| Q4 | Test design-system: `lib/format` (id-ID, zona waktu) + komponen `feedback/` (role/label, keyboard, state) | qa-tester | done (PR #3) | F1 |
| Q6 | Test `packages/seo` (meta/canonical/robots) + smoke SSR `apps/web` (render root, error boundary) | qa-tester | done (PR #4) | F3 |
| Q7 | Test `packages/db` (`newId`, `createTestDb`, `primaryId`/`timestamps`, klien) + `@trush/env/db` | qa-tester | done (PR #8) | B4 |
| Q8 | Test `packages/phone` (E.164, pemilihan driver, payload Twilio), `@trush/env` phone, OTP telepon di `@trush/auth` | qa-tester | done | B7 |
| Q9 | Test reproduksi temuan review keamanan PR #10 (auth 7, app 22, env 2) | qa-tester | done | — |
| Q5 | Test observability: redaksi (termasuk bersarang), bentuk JSON, `requestId` di setiap log, sink BetterStack gagal tidak melempar, guard level production | qa-tester | done (PR #3) | B3 |

Catatan lanjutan dari batch ini:

- F4: klien auth `createAuthClient({ baseURL, plugins: createAuthClientPlugins() })` dari `better-auth/react` + `@trush/auth/client`; token Turnstile di header `x-captcha-response` (`CAPTCHA_HEADER`); `credentials: "include"`; teruskan header `cookie` saat SSR lewat Service Binding; kontrak `@trush/core/schemas/me`.
- Saat `@trush/email` siap: `requireEmailVerification: true` + `emailVerification.sendVerificationEmail` di `packages/auth/src/auth.ts`.
- Skema auth bawaan CLI: kolom `timestamp` tanpa zona waktu dan `member` tanpa unique (organization_id, user_id); perketat lewat migrasi terpisah bila diputuskan.
- `/api/me` 200 end-to-end belum teruji di project worker (DATABASE_URL palsu); tutup di Q3 (Playwright ke branch Neon).
- `apps/web` `entry.server.tsx` `onError` belum melaporkan error ke mana pun; sambungkan saat analytics/observability web dikerjakan.
- `@trush/seo`: sitemap + JSON-LD saat ada halaman marketing nyata.
- Q3: blok `env.e2e` di `wrangler.jsonc` web (dan api di B8).
- L3/L4: ganti placeholder `CORS_ORIGINS` di `apps/api/wrangler.jsonc`; sediakan `VITE_SITE_URL`/`VITE_APP_URL`/`VITE_APP_ENV` saat `CLOUDFLARE_ENV=… vite build`.
- `typegen` semua app memakai `wrangler types --env-file .dev.vars.example`: setiap var/secret baru WAJIB masuk `.dev.vars.example` agar ada di tipe `Env` (F4 `apps/app` ikut pola ini).
- Naikkan `SCALAR_BUNDLE_URL` (`apps/api/src/middleware/security.ts`) bersamaan dengan `@scalar/hono-api-reference`.

- B7 keputusan terbuka dijadikan task lanjutan B7b (timing reset password) dan B7c (rate limit per pengguna/nomor).
- Test entry.server `apps/app` (`onError` 500) belum ada.
- B8: `TODO(B8)` di `packages/env/src/phone.ts` (`E2E=true` mewajibkan `PHONE_DRIVER=memory`).

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

- 2026-11-01 — Pra-merge PR #10: B7 dan F4 done. Keputusan user: dua celah terbuka B7 menjadi task lanjutan B7b + B7c (tidak menahan merge). Lint `vitest/prefer-called-with` (preset Ultracite) dicek: autofix ke `toHaveBeenCalledWith()` justru memperketat assert dan gagal keras bila argumen tidak cocok, `.not.toHaveBeenCalled()` tetap diizinkan; config tidak diubah. qa-tester menghapus docblock `@vitest-environment node` redundan di 5 test `apps/app`. Judul PR #10 diganti (login OTP tidak lagi ada).
- 2026-11-01 — PR #10 (Draft) dibuka. CI: `fix(repo)` `build:types` bergantung `typegen` (race di checkout bersih). Review keamanan subagent (komentar PR): 3 temuan nyata + 1 low. Keputusan user: login OTP dimatikan (telepon hanya tambahan akun). Q9 repro → B7a + F4a diperbaiki. `e2e` tetap merah sampai Q3.
- 2026-11-01 — B7 dan F4 ke review di `feat/b7-f4-phone-app` (belum ada PR). Perbaikan B7 (`fix(auth)`): OTP dikirim sinkron tanpa `backgroundTasks`, sehingga error Twilio menjadi 4xx berkode domain / 502 `OTP_DELIVERY_FAILED`; nomor tak terdaftar tidak dikirimi OTP dan responsnya identik. Q8 done (test phone, env, auth). Catatan lanjutan selesai: host resmi bersama di `@trush/core`, `ErrorPage` di design-system. PR batch menunggu Q2b.
- 2026-11-01 — Q2b done (`test(app)`): 163 test `apps/app` (guard sesi, `getSafeRedirect`, action auth, api-client, security headers, form), tanpa bug. Batch `feat/b7-f4-phone-app` siap PR.
- 2026-10-31 — PR #9 di-merge (B6, Q2a). Batch `feat/b7-f4-phone-app`: B7 dan F4 wip paralel. Lead memasang dependensi `packages/phone` (`libphonenumber-js` langsung), `apps/app` (pola `apps/web` + `better-auth`, `@tanstack/react-query`, `@trush/api|auth|core`), dan `@trush/phone` di `packages/auth`.
- 2026-10-31 — B6 + Q2a selesai di `feat/b6-auth`. Lead: override `no-inline-comments` untuk `schema/auth.ts` hasil CLI, `@types/node` dev di `apps/api` (hanya `tsconfig.node.json` test db), `docs/auth-plugins.md` (captcha `/sign-in/username`, `openAPI` `disableDefaultReference`). Secret staging/production (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `TURNSTILE_SECRET_KEY`) diisi manusia saat L3/L4.
- 2026-10-31 — PR #8 di-merge (B4, B4a, Q7). Approval CODEOWNERS terbukti menahan merge walau `required_approving_review_count: 0`. Batch `feat/b6-auth`: B6 wip. Keputusan user: plugin `phoneNumber` masuk B7, `emailOTP` dan `polar` masuk fase email/payments (masing-masing migrasi auth tambahan); `requireEmailVerification: false` sampai `@trush/email` siap (wajib diaktifkan saat itu).
- 2026-10-31 — Batch `feat/b4-db`: B4 (user memilih "infra saja": tanpa tabel aplikasi; tabel auth dari CLI di B6), Q7, B4a (bug Q7). Lead: task turbo `db:generate`/`db:migrate` (`passThroughEnv` `DATABASE_URL_UNPOOLED`), dependensi catalog `db`, `packages/db/drizzle/**` diabaikan oxfmt. Migrasi Neon diverifikasi lewat job `e2e` PR.
- 2026-10-31 — PR #4 di-merge ke `main`. L1 done: git/gh agent kini memakai GitHub App `trush-app[bot]` (token lokal, di luar repo), jadi PR dibuat bot dan `rizalzmrni` dapat approve sebagai CODEOWNER. PR ini PR pertama dari bot.
- 2026-10-31 — L5: `e2e` PR #5 gagal di langkah "Buat branch Neon sementara" karena branch parent `dev` tidak ada (hanya `production`). Branch Neon `dev` dibuat dari `production`.
- 2026-10-31 — L1 done: ruleset `protect-main` dilengkapi (review Code Owners wajib, squash saja, penghapusan `main` diblokir; sebelumnya ketiganya belum ada). Prasyarat merge oleh lead (`docs/pull-requests.md` bagian 0) terpenuhi: lead merge dengan `gh pr merge <n> --squash --auto --delete-branch`.
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
