# React Router di Cloudflare Workers (apps/app & apps/web)

Diimpor oleh `apps/app/CLAUDE.md` dan `apps/web/CLAUDE.md`.

## Boundary client/server

- Ambil data di **loader**, ubah data di **action** atau `useMutation`.
- Loader/action berjalan di Worker; komponen terkirim ke browser. Jangan menaruh secret, akses DB, atau impor server-only di modul yang ikut ke bundle klien.
- Env & binding server hanya lewat `getCloudflare(context).env` di loader/action (`src/lib/cloudflare.ts`), bukan dari modul top-level. Sejak React Router 8 `context` adalah `RouterContextProvider` (`AppLoadContext` dihapus), jadi `src/worker.ts` mengisi `cloudflareContext` lewat `context.set(...)`. Env klien hanya `VITE_*` lewat `packages/env`.
- Modul yang hanya boleh jalan di server diberi akhiran `.server.ts` agar bundler menolak bila terimpor dari kode klien.
- Kode sumber di `src/` (`appDirectory: "src"`), bukan default `app/`, agar seragam dengan paket lain. Satu file per route di `src/routes/`; route tipis, hanya menyusun fitur dari `src/features/`.

## Memanggil api: Service Binding

- `wrangler.jsonc` mendeklarasikan service binding `API` ke Worker `api`.
- Klien dibuat dengan `hcWithType` dari `@trush/api/client` (pola panduan RPC Hono untuk monorepo), bukan `hc<AppType>`: tipenya dibaca dari `.d.ts` hasil `build:types` api, sehingga app tidak meng-type-check source api dengan global `Env`/lib DOM miliknya. Setelah mengubah route api, jalankan `bun run build:types` di `apps/api` agar tipe di editor ikut berubah (`check-types` menjalankannya otomatis lewat turbo).
- Saat SSR (loader/action), klien memakai `fetch` dari binding `API` (`getCloudflare(context).env.API`), bukan URL publik. Alasan: tanpa hop jaringan publik dan tanpa masalah CORS.
- Teruskan header `cookie` (sesi), `origin` (cek CSRF better-auth), `cf-connecting-ip` (rate limit per pengguna), dan `user-agent` dari `request` asli. Login/logout lewat action yang memanggil `/api/auth/*` via binding lalu meneruskan `Set-Cookie` api ke respons app.
- Di browser, klien memakai `VITE_API_URL` publik dengan `credentials: "include"`.
- Buat satu factory di `src/lib/api-client.ts` yang menerima mode (server dengan binding + request, atau browser); jangan membuat klien di tempat lain.
- Cek sintaks service binding & cara memanggilnya di dokumentasi resmi Cloudflare dan `@cloudflare/vite-plugin` versi terpasang.
- Dev lokal: `wrangler dev` (api) dan `@cloudflare/vite-plugin` (app) membaca dev registry di path default yang berbeda, sehingga binding `API` membalas 503 "no local dev session". Jalankan api dan app dengan `CLOUDFLARE_DEV_REGISTRY_PATH` absolut yang sama (mis. `CLOUDFLARE_DEV_REGISTRY_PATH=$PWD/.wrangler/registry bun run dev`); turbo meneruskannya lewat `passThroughEnv` task `dev`, dan Playwright menyetelnya di `webServer`.

## Auth gate

- Loader halaman terproteksi memanggil `GET /api/me` lewat Service Binding (data pengguna; organisasi diambil dari `:slug` URL lewat `/api/me/organizations`, bukan dari sesi; lebih lengkap dari `/api/auth/get-session`). 401 → `redirect` ke `/sign-in?redirectTo=…`; status error lain dilempar ke ErrorBoundary. `redirectTo` selalu disaring `getSafeRedirect` (hanya path internal) untuk mencegah open redirect.
- `apps/app`/`apps/web` **tidak** mengakses DB dan tidak mengimpor konfigurasi server better-auth; hanya klien better-auth (entry `@trush/auth/client`).
- Gunakan satu helper `requireSession({ request, context })` agar tidak diulang di setiap route.

## Pola data: loader prefetch + TanStack Query

1. Loader membuat QueryClient per request, memanggil `queryClient.ensureQueryData({ queryKey, queryFn })` dengan `queryFn` yang sama dengan yang dipakai di komponen.
2. Loader mengembalikan state hasil `dehydrate(queryClient)`.
3. Root/route membungkus dengan `HydrationBoundary`; komponen memakai `useQuery` dengan query key yang sama, sehingga tidak ada fetch ganda.
4. Mutasi: `useMutation` + `queryClient.invalidateQueries` dengan key dari `features/<fitur>/query-keys.ts`.

- QueryClient server dibuat **per request** (jangan dibagi antar-request).
- Query key dan `queryFn` didefinisikan sekali per fitur, di `features/<fitur>/queries.ts` dan `query-keys.ts`.

## Security headers

- Header keamanan dokumen HTML dipasang di `src/entry.server.tsx`: CSP dengan nonce per request, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, dan HSTS hanya bila `APP_ENV=production` di domain resmi.
- Nonce yang sama diteruskan ke `<ServerRouter nonce>` dan ke `ThemeProvider` next-themes (`nonce`), karena keduanya menyisipkan script inline. Tanpa itu, CSP memblokir hydration dan skrip anti-kedip tema.
- `script-src` dan `connect-src` hanya memuat domain yang benar-benar dipakai (GA/PostHog di app yang memuatnya, `VITE_API_URL` di `connect-src`, dan `https://challenges.cloudflare.com` di `script-src`/`frame-src` khusus halaman dengan form auth). Domain baru di CSP disebut di deskripsi PR.
- `'unsafe-inline'` dan `'unsafe-eval'` dilarang di `script-src`.

## Type-check

- `react-router typegen` harus jalan sebelum `tsc --noEmit`; task `check-types` di `turbo.json` bergantung pada `typegen`.
- Pakai tipe `Route.LoaderArgs`, `Route.ComponentProps`, dll. dari `./+types/<route>`; jangan menulis tipe loader manual.

## SEO (apps/web)

- Metadata lewat `meta` export dan helper dari `packages/seo`.
- Halaman marketing tidak butuh sesi; jangan memanggil auth gate kecuali halaman tersebut menampilkan status login.
