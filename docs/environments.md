# Lingkungan: development, staging, production — trush

Satu-satunya penanda lingkungan adalah `APP_ENV` (`development | staging | production`), divalidasi oleh factory `@trush/env`. Kode tidak menebak lingkungan dari hostname, `NODE_ENV`, atau `import.meta.env.MODE`.

## Ringkasan

|  | development | staging | production |
| --- | --- | --- | --- |
| Tujuan | kerja lokal dan e2e | uji sebelum rilis dengan data palsu | pengguna nyata |
| Tempat jalan | `bun run dev` (Vite + workerd lokal); e2e: `CLOUDFLARE_ENV=e2e` | `CLOUDFLARE_ENV=staging` | `CLOUDFLARE_ENV=production` |
| URL | `localhost` (web 5173, app 5174, api 8787) | `*.workers.dev`, lalu `staging.<domain>` | `<domain>`, `app.<domain>`, `api.<domain>` |
| Deploy | — | manual oleh manusia (L3); otomatis saat merge ke `main` setelah L4 | manual lewat approval GitHub Environment `production` |
| Neon | branch `dev` (+ branch sementara per PR untuk e2e) | branch `staging` | branch utama |
| Data | seed palsu | seed palsu, tanpa salinan data produksi | data nyata |
| Secret | `.dev.vars` per app (`.dev.vars.e2e` untuk e2e) | `CLOUDFLARE_ENV=staging wrangler secret put` + Environment `staging` | `CLOUDFLARE_ENV=production` + Environment `production` |

## Layanan pihak ketiga per lingkungan

| Layanan | development | staging | production |
| --- | --- | --- | --- |
| Polar | `sandbox` | `sandbox` | `production` |
| Resend | kunci uji, ke `delivered@resend.dev`; `memory` bila `E2E=true` | domain staging, penerima tim | domain produksi |
| Twilio (`PHONE_DRIVER`) | `log`, `twilio-test`, atau `memory` bila `E2E=true` | `twilio` + `PHONE_ALLOWLIST` | `twilio` |
| PostHog | tanpa key (no-op) atau project dev | project staging | project produksi |
| Google Analytics | tanpa ID (no-op) | tanpa ID | ID produksi |
| Turnstile (`captcha`) | kunci uji (selalu lolos) | widget staging | widget produksi |
| BetterStack | nonaktif (console saja) | source staging | source produksi |
| `API_DOCS_ENABLED` | `true` | `true` | `false` |
| SEO | `noindex` | `noindex` | diindeks |
| `LOG_LEVEL` | `debug` | `info` | `info` |

## Aturan

- `APP_ENV` wajib di setiap Worker (`vars` di blok `env.<nama>` pada `wrangler.jsonc`) dan di `.dev.vars`, tanpa nilai default.
- Lingkungan Cloudflare dipilih dengan `CLOUDFLARE_ENV`, bukan flag `--env`, agar seragam untuk Wrangler dan Vite. Satu pengecualian: `wrangler dev` (4.156) hanya membaca `.dev.vars.<env>` bila flag `--env` dipakai, jadi api lingkungan e2e dijalankan lewat script `dev:e2e` (`wrangler dev --env e2e`), bukan `CLOUDFLARE_ENV=e2e wrangler dev`.
- `apps/app` dan `apps/web` (Vite) menetapkan lingkungan **saat build**: `CLOUDFLARE_ENV=staging vite build`, lalu `wrangler deploy` memakai config hasil build (`CLOUDFLARE_ENV` saat deploy tidak berpengaruh). Nilai `VITE_*` juga dibakar saat build, jadi app di-build ulang per lingkungan; tidak ada pola "build sekali lalu dipromosikan". `apps/api` cukup `CLOUDFLARE_ENV=staging wrangler deploy`.
- Lingkungan lokal `e2e` (blok `env.e2e`: `APP_ENV=development`, `E2E=true`) hanya dipakai Playwright dan tidak pernah di-deploy. Secret-nya di `.dev.vars.e2e`; bila file itu ada, `.dev.vars` umum diabaikan, jadi semua secret wajib ada di dalamnya.
- Klien membaca lingkungan dari `VITE_APP_ENV`, yang wajib sama dengan `APP_ENV`; factory server menolak bila berbeda.
- Factory `@trush/env` menolak kombinasi berbahaya saat `APP_ENV=production`: Polar `sandbox`, `PHONE_DRIVER` selain `twilio`, `LOG_LEVEL=debug`, kunci uji Turnstile, atau `E2E=true`. `E2E=true` hanya sah bila `APP_ENV=development`.
- Satu `wrangler.jsonc` per Worker dengan blok `env.staging` dan `env.production`. Nama Worker berakhiran lingkungan (`trush-api-staging`), dan Service Binding `API` menunjuk Worker api di lingkungan yang sama.
- Data produksi tidak pernah disalin ke development atau staging. Data realistis dibuat lewat seed; skrip seed menolak `APP_ENV=production`.
- Migrasi dijalankan sebelum deploy Worker di lingkungan yang sama: staging dulu, produksi setelah staging sukses.
- Agent tidak memegang secret staging/produksi dan tidak menjalankan `wrangler deploy`, `wrangler secret`, atau `wrangler rollback` (diblokir di `.claude/settings.json`). Itu dikerjakan manusia atau workflow deploy.

## Alur promosi

1. PR → CI (`checks`, `pr-title`, `e2e`).
2. Merge ke `main` → migrasi staging → deploy staging.
3. Uji di staging (manual + smoke test).
4. Rilis produksi: workflow deploy production (manual, approval Environment) → migrasi produksi → deploy `api`, lalu build + deploy `app` dan `web` dengan `CLOUDFLARE_ENV=production`.
5. Rollback: `CLOUDFLARE_ENV=production wrangler rollback` per Worker. Migrasi tidak di-rollback; pola expand/contract menjaga kode versi sebelumnya tetap cocok dengan skema baru.

## Backup & pemulihan

- Branch produksi Neon memakai history retention (point-in-time restore) sepanjang yang diizinkan plan. Jendelanya dicatat di sini: {{hari}} hari.
- Sebelum migrasi contract (drop/rename) di produksi, buat branch cadangan `backup/<tanggal>-<migrasi>` dari produksi. Hapus setelah 14 hari bila tidak dipakai.
- Pemulihan (dikerjakan manusia):
  1. Buat branch baru dari produksi pada titik waktu sebelum insiden.
  2. Verifikasi data di branch itu dengan query baca saja.
  3. Arahkan secret `DATABASE_URL`/`DATABASE_URL_UNPOOLED` produksi ke branch hasil restore, atau salin balik hanya tabel yang terdampak.
  4. Catat insiden, penyebab, dan langkahnya di `docs/incidents/<tanggal>.md`.
- R2 tidak tercakup restore Neon; kebijakan backup objek ditetapkan saat fitur storage dibuat.
- Secret produksi juga disimpan di password manager tim, bukan hanya di Cloudflare dan GitHub.
- Uji pemulihan sekali sebelum go-live, lalu setiap 3 bulan.

## Selama belum ada domain

Staging memakai `*.workers.dev`. Cookie sesi lintas app (app ↔ api) belum bisa diandalkan di sana, jadi alur login diuji di development dan e2e lokal. Domain wajib ada sebelum L4 (workflow deploy otomatis).
