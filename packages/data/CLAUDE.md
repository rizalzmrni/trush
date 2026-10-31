# packages/data — TanStack Query, Form, dan Table

Lapisan data bersama frontend trush: factory QueryClient + provider, form hook TanStack Form yang memakai field design-system, dan helper TanStack Table.

## Batas & kepemilikan

- **Isi:** `createQueryClient()` dan provider, `useAppForm` (`createFormHook` dengan field dari `@trush/design-system`), helper `useReactTable`, devtools.
- **Dipakai oleh:** `apps/app` (utama), `apps/web` bila perlu data interaktif.
- **Tidak boleh:** query key/`queryFn` per fitur (di `apps/*/src/features`), klien API (di `src/lib/api-client.ts` app), komponen presentasional (ke `@trush/design-system`), skema Zod domain (ke `@trush/core`).
- **Pemilik (tim agent):** `frontend-engineer`
- **Risiko perubahan:** Menengah — default QueryClient memengaruhi semua fetch.

## Aturan wajib

- Server: satu QueryClient baru per request. Browser: satu instance per tab (dibuat sekali di provider).
- Default `staleTime` > 0 (mis. 60 detik) agar data hasil prefetch loader tidak langsung di-fetch ulang setelah hydration.
- Default `retry` tidak mengulang error 4xx; hanya error jaringan/5xx.
- Validasi form memakai skema dari `@trush/core`, tidak menulis ulang skema di form. Error field ditampilkan lewat field design-system (`aria-invalid`).
- State tabel (pagination, sort, filter) dikendalikan app (mis. dari URL); paket ini hanya menyediakan helper, bukan state global.
- Devtools hanya dimuat bila `VITE_APP_ENV=development` (lazy import).

## Jebakan

- QueryClient di scope modul pada server → cache dan data pengguna bocor antar request.
- `staleTime: 0` → fetch ganda tepat setelah SSR.
- Mengimpor devtools secara statis → ikut bundel produksi.

## Pengujian

- **Lingkungan:** happy-dom
- **Wajib diuji:** default QueryClient (tanpa retry 4xx, `staleTime`), form hook (error validasi tampil dengan `aria-invalid`), helper tabel (sort, pagination).
- **Dilarang di test:** jaringan nyata. Mock `queryFn`.

## Rujukan

- `docs/react-router.md` — pola loader prefetch + dehydrate.
- `DESIGN.md` — bagian Form dan Tabel.
