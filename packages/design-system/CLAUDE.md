# packages/design-system — Token, komponen UI, dan tema

Sumber utama tampilan trush: `globals.css` kanonik, komponen shadcn/ui, komponen presentasional reusable, util, dan provider tema. Aturan visualnya di `DESIGN.md`.

## Batas & kepemilikan

- **Isi:** `src/styles/globals.css`, `src/components/ui` (hasil CLI shadcn), `src/components/{layout,navigation,form,feedback}`, `src/lib` (`utils`, `format`, `font`), `src/hooks`, `DesignSystemProvider` (next-themes + Toaster).
- **Dipakai oleh:** `apps/web`, `apps/app`, `apps/storybook`, `@trush/data`.
- **Tidak boleh:** fetch, sesi, klien API, TanStack Query/Form/Table (ke `@trush/data`), copy teks khusus app, token di luar `globals.css`.
- **Pemilik (tim agent):** `frontend-engineer`
- **Risiko perubahan:** Menengah — dipakai semua app; perubahan token mengubah seluruh tampilan.

## Aturan wajib

- Komponen `src/components/ui` hanya lewat `bunx shadcn@latest add <komponen>` dengan cwd paket ini. Folder itu tidak di-lint/format, jadi setiap diff-nya direview manual.
- Komponen reusable bersifat presentasional: data lewat props, tanpa efek samping jaringan. Setiap komponen reusable baru punya story di `apps/storybook`.
- Ekspor lewat subpath di `package.json` (`./components/*`, `./lib/*`, `./hooks/*`, `./styles/globals.css`), sejalan dengan alias di `components.json`; tanpa barrel.
- Formatter angka, tanggal, mata uang hanya di `src/lib/format.ts` (locale `id-ID`, zona waktu pengguna).
- Baris `@source "../";` di `globals.css` dipertahankan.

## Jebakan

- `shadcn add` dijalankan dari root atau app → komponen tercecer di luar paket. Jalankan dari `packages/design-system`.
- CLI mengubah nilai token di `globals.css` → kembalikan; hanya token baru yang boleh masuk, dan dicatat di `DESIGN.md`.
- Mengimpor `@trush/data` dari paket ini → dependensi melingkar. Arahnya satu: `data` memakai `design-system`.
- Lupa `suppressHydrationWarning` di `<html>` atau `fontLinks` di root layout app → peringatan hydration dan font jatuh ke `sans-serif`.

## Pengujian

- **Lingkungan:** happy-dom
- **Wajib diuji:** komponen reusable (render, role/label aksesibel, navigasi keyboard, state loading/error/empty), `lib/format` (locale `id-ID`, zona waktu).
- **Dilarang di test:** snapshot atau test atas `src/components/ui` (output CLI), jaringan.

## Rujukan

- `DESIGN.md` — token, komponen, daftar periksa UI.
- `packages/design-system/components.json` — konfigurasi CLI shadcn.
