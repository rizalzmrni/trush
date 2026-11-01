# Hono API di Cloudflare Workers (apps/api)

Diimpor oleh `apps/api/CLAUDE.md`.

## Kontrak API (type-safety end-to-end)

- Pakai `OpenAPIHono` dari `@hono/zod-openapi`. Setiap endpoint didefinisikan dengan `createRoute` (method, path, request, responses, tags, summary) dan dipasang dengan `.openapi()`, sehingga satu skema Zod menjadi validasi, tipe, dan dokumentasi sekaligus.
- Rangkai route secara chaining agar tipe RPC terbentuk; ekspor `export type AppType = typeof app` dan `type Bindings` dari `src/index.ts`.
- Konsumen (app/web) memakai `hcWithType` dari `@trush/api/client` (`src/client.ts`). Tipenya di-compile oleh `build:types` (`tsconfig.types.json` → `dist/types`, di-gitignore) dengan konfigurasi api sendiri; `src/client.ts` hanya boleh mengimpor `AppType` sebagai tipe (`import type`) agar kode server tidak ikut ke bundle konsumen.
- Skema domain bersama berasal dari `packages/core/src/schemas`.
- Bentuk error seragam, dengan status HTTP yang sesuai: `{ error: { code: string; message: string; details?: unknown } }`. Ditangani oleh satu `app.onError` global dan `defaultHook` OpenAPIHono untuk error validasi.

## Lapisan

`src/routes/<domain>.ts` (HTTP, validasi, dokumentasi) → `src/services/<domain>.ts` (logika bisnis, otorisasi kepemilikan) → `packages/db`. Route tidak memanggil DB atau binding R2 langsung.

## Dokumentasi API

- OpenAPI 3.1 dihasilkan dari `createRoute`, tidak ditulis manual.
- `GET /openapi.json` (dokumen) dan `GET /docs` (Scalar).
- Setiap route wajib punya: `tags`, `summary`, `description` bila perilaku tak jelas dari nama, skema request, dan skema **semua** respons (sukses & error).
- Skema yang tampil di dokumentasi diberi `.openapi({ example, description })` dan nama komponen yang stabil.
- Route yang butuh login ditandai security scheme sesi (cookie better-auth).
- `/docs` dan `/openapi.json` aktif di development; di production hanya bila `API_DOCS_ENABLED=true`.

## Env & binding

- Akses lewat `c.env`, bertipe `Bindings`, divalidasi factory `@trush/env` (`createApiEnv`) dengan `runtimeEnv` dari binding.
- Tipe binding dihasilkan dengan `wrangler types` (dijalankan oleh `typegen`). Pakai `@cloudflare/workers-types` hanya bila dokumentasi resmi Cloudflare versi terpasang masih menyarankannya.
- Jangan memasang `@types/bun` atau `@types/node` di tsconfig paket ini: global Bun/Node akan lolos type-check padahal tidak ada di workerd.

## Auth & CORS

- Handler better-auth di `/api/auth/*`, termasuk webhook plugin `polar`.
- CORS: `credentials: true`, origin dari `CORS_ORIGINS` (bukan `*`).
- Middleware auth menaruh sesi di context; service menerima `userId` (dan `organizationId` bila scoping per-organisasi) sebagai parameter eksplisit.

## Security headers

- `secureHeaders()` dari `hono/secure-headers` dipasang sebagai middleware global.
- Respons JSON: CSP `default-src 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- HSTS (`max-age=31536000; includeSubDomains`) hanya bila `APP_ENV=production` di domain resmi; tidak di `workers.dev` atau localhost.
- Route `/docs` (Scalar) memakai CSP sendiri yang mengizinkan aset Scalar; pengecualian ini hanya untuk route itu.

## Rate limiting

- Pakai binding **Rate Limiting** Workers (dideklarasikan di `wrangler.jsonc`), dibungkus di `src/middleware/rate-limit.ts`. Jangan menyimpan hitungan di variabel modul: setiap isolate punya memori sendiri, jadi hasilnya tidak berlaku.
- Pengecualian: kuota dengan jendela lebih dari 60 detik atau berkunci selain IP (mis. kuota OTP per nomor/pengguna, `packages/auth/src/otp-rate-limit.ts`) disimpan di Postgres dengan upsert atomik, karena binding Rate Limiting hanya mendukung periode 10/60 detik dan tabel `rate_limit` better-auth hanya per IP + path.
- Webhook Polar (di bawah `/api/auth/*`) dikecualikan dari rate limit per IP.
- Endpoint pengiriman OTP (`/api/auth/phone-number/*`, `/api/auth/email-otp/*`) dibatasi lebih ketat: per nomor/email dan per IP, untuk mencegah SMS pumping.
- Cek sintaks konfigurasi di dokumentasi resmi Cloudflare sebelum menulisnya.

## Logging, error tracking, analitik

- Logger dari `@trush/observability/logger`; konteks per request (`requestId`, `userId`) dipasang di middleware. Aktifkan Workers Logs di `wrangler.jsonc`; flush sink BetterStack dibungkus `c.executionCtx.waitUntil()` agar tidak menahan respons.
- Error tracking: PostHog Error Tracking lewat `@trush/observability/posthog` (`$exception` via HTTP capture API) dari `app.onError`, dengan `handled: false` dan `distinctId` dari sesi bila ada; juga dibungkus `waitUntil`.
- Event PostHog dari server dikirim lewat HTTP capture API dengan `fetch` + `waitUntil` (tanpa SDK Node).

## Email & pembayaran

- Panggil fungsi kirim dari `packages/email`; jangan membangun HTML email di sini.
- Tidak ada route webhook Polar terpisah: webhook dilayani plugin `polar` (`packages/auth`) dengan handler dari `packages/payments`.

## Testing

- Dua project Vitest (`vitest.config.ts`): `worker` (workerd, `*.test.ts` selain `*.db.test.ts`) dan `db` (Node + PGlite, `*.db.test.ts`). Test service yang menyentuh DB memakai `createTestDb()` dari `@trush/db/testing`, fixture di `src/testing/db-fixtures.ts`, dan `createMemoryStorage()` dari `@trush/storage/testing` sebagai pengganti R2.
- Handler dan middleware diuji dengan `@cloudflare/vitest-plugin` (pengganti `@cloudflare/vitest-pool-workers` yang deprecated; mendukung Vitest 5) di workerd asli dengan binding lokal. Dipasang sebagai plugin Vite `cloudflareTest({ wrangler, miniflare })` di `vitest.config.ts`; test memakai `import { env, exports } from "cloudflare:workers"` dan `exports.default.fetch(...)`.
- Binding uji (env palsu) ada di `vitest.config.ts`, bukan `.dev.vars`, agar test tidak pernah menyambung ke DB atau layanan nyata. Stub layanan eksternal (Polar, Resend, PostHog); jangan memanggil jaringan nyata.
- `GET /__e2e/outbox` (pesan terakhir dari driver `memory` `@trush/phone` dan `@trush/email`) hanya didaftarkan bila `APP_ENV=development` dan `E2E=true`. Test wajib memastikan route itu 404 di luar kondisi tersebut.
- Request pertama di workerd lambat (±5 detik, Vite mentransformasi modul), jadi file test melakukan request pemanasan di `beforeAll`. Rate limit diuji dengan `cf-connecting-ip` berbeda per test agar hitungan tidak saling bocor.
