# trush

Boilerplate SaaS di atas Turborepo + bun yang berjalan di Cloudflare Workers: situs marketing (`apps/web`), aplikasi utama (`apps/app`), dan API (`apps/api`), dikerjakan bersama tim agent Claude Code.

## Prasyarat

- bun, versi sesuai `devEngines` di `package.json`
- Akun Cloudflare (Workers, R2), lalu `bunx wrangler login`
- Project Neon dengan branch `dev`
- Akun uji: Polar (sandbox), Resend, Twilio (test credentials), PostHog (opsional)
- Claude Code, untuk bekerja dengan tim agent (lihat `AGENTS.md`)

## Mulai

```bash
bun install                      # juga memasang hook Husky
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/app/.dev.vars.example apps/app/.dev.vars
cp apps/web/.dev.vars.example apps/web/.dev.vars
bunx turbo run db:migrate --filter=@trush/db
bun run dev
```

| App | URL lokal                                      |
| --- | ---------------------------------------------- |
| web | http://localhost:5173                          |
| app | http://localhost:5174                          |
| api | http://localhost:8787 (dokumen API di `/docs`) |

## Script

| Perintah | Fungsi |
| --- | --- |
| `bun run dev` | Semua app dalam mode development |
| `bun run check-types` | Typegen + type-check semua paket |
| `bun run check` / `bun run fix` | Lint & format (Ultracite) |
| `bun run test` | Vitest di semua paket |
| `bun run test:e2e` | Playwright; butuh `.dev.vars.e2e` (lihat `e2e/CLAUDE.md`) |

## Struktur

```
apps/       web, app, api, email (preview), storybook
packages/   env, db, auth, core, design-system, data, payments, phone, email,
            storage, analytics, observability, seo, typescript-config
e2e/        test end-to-end Playwright
docs/       aturan git, PR, dependensi, lingkungan, React Router, Hono API, ADR
```

## Dokumen penting

- `CLAUDE.md` dan `AGENTS.md`: aturan global dan tim agent.
- `DESIGN.md`: token visual, komponen, daftar periksa UI.
- `STATUS.md`: posisi pekerjaan saat ini.
- `docs/environments.md`: development, staging, production, backup.
- `docs/git.md` dan `docs/pull-requests.md`: alur branch, commit, dan PR.

## Deploy

Deploy ke staging dan produksi dikerjakan manusia atau workflow GitHub, bukan agent. Langkahnya ada di `docs/environments.md`.
