# apps/api — API Hono di Workers

Server HTTP trush (Worker `api`): Hono + `@hono/zod-openapi`, dokumen OpenAPI disajikan lewat Scalar.

@../../docs/hono-api.md

## Batas & kepemilikan

- **Isi:** route (`src/routes/<domain>.ts`), service (`src/services/<domain>.ts`), middleware (`src/middleware`), `src/openapi.ts`, entry `src/index.ts`, klien RPC (`src/client.ts` → `@trush/api/client`), fixture test (`src/testing/`).
- **Dipakai oleh:** `apps/app` dan `apps/web` lewat Service Binding `API` (SSR) atau URL publik (browser), dengan `hcWithType`.
- **Tidak boleh:** logika domain murni (ke `@trush/core`), DB atau binding R2 dipanggil dari route, HTML email, kode server di `src/client.ts`.
- **Pemilik (tim agent):** `backend-engineer`
- **Risiko perubahan:** Menengah — kontrak publik dipakai frontend.

## Aturan wajib

- Route terproteksi melewati middleware sesi `@trush/auth` dan ditandai security scheme cookie di OpenAPI; tidak ada pemeriksaan cookie/token manual.
- Otorisasi kepemilikan data diputuskan di service, yang menerima `userId` / `organizationId` sebagai parameter eksplisit.
- CORS `credentials: true` dengan origin dari `CORS_ORIGINS`, tidak pernah `*`.
- Setiap route punya `tags`, `summary`, skema request, dan skema semua respons.
- Error selalu `{ error: { code, message, details? } }` lewat `app.onError` + `defaultHook`; tanpa stack trace atau pesan internal.
- `/docs` dan `/openapi.json` di production hanya bila `API_DOCS_ENABLED=true`.
- `GET /api/me` dan `GET /api/me/organizations` adalah sumber auth gate frontend; bentuk response-nya kontrak di `packages/core`.

## Jebakan

- Route tidak dirangkai berantai, atau memakai `Hono` biasa → tipe RPC dan dokumen hilang. Pakai `OpenAPIHono` + chaining.
- `src/client.ts` mengimpor nilai dari `src/index.ts` → kode server ikut bundle app. Hanya `import type { AppType }`.
- Klien DB/auth di scope modul → env belum ada. Buat per request dari `c.env`, simpan di `c.var`.
- Hitungan rate limit di variabel modul → tidak berlaku lintas isolate. Pakai binding Rate Limiting.
- Mengubah route tanpa `bun run build:types` → editor app memakai tipe lama.
- `/__e2e/outbox` (`src/routes/e2e.ts`, kontrak `@trush/core/schemas/e2e`) dijaga `e2eGuard` (`E2E=true` + development, selain itu 404), `hide: true` di OpenAPI, dan sengaja di luar rantai `AppType`.

## Pengujian

- **Lingkungan:** `@cloudflare/vitest-plugin` (project `worker`) + Node/PGlite (project `db`, `*.db.test.ts`).
- **Wajib diuji:** validasi (400, bentuk error seragam), otorisasi (401/403 dan kepemilikan di service), CORS, rate limit, response sesuai skema.
- **Dilarang di test:** jaringan nyata, `.dev.vars`, DB/layanan produksi; stub Polar, Resend, PostHog.

## Rujukan

- `docs/hono-api.md` — kontrak, dokumentasi, env, rate limit, logging, testing (diimpor di atas).
- `docs/react-router.md` — cara frontend memanggil api.
- `packages/core/CLAUDE.md`, `packages/auth/CLAUDE.md`.
