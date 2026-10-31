# apps/app — Aplikasi utama (React Router SSR)

Aplikasi produk trush untuk pengguna yang login: React Router framework mode (SSR) + Vite + `@cloudflare/vite-plugin`, deploy ke Workers.

@../../docs/react-router.md

## Batas & kepemilikan

- **Isi:** route + loader/action (`src/routes`), fitur (`src/features/<fitur>/`: komponen, `queries.ts`, `query-keys.ts`, form), komponen generik khusus app (`src/components`), util & factory (`src/lib`), entry Worker `src/worker.ts`.
- **Dipakai oleh:** pengguna akhir; tidak diimpor app/paket lain.
- **Tidak boleh:** akses DB, impor entry server `@trush/auth`, komponen shadcn (di-generate ke `packages/design-system`), klien API di luar `src/lib/api-client.ts`.
- **Pemilik (tim agent):** `frontend-engineer`
- **Risiko perubahan:** Menengah — produk utama; memegang auth gate dan data pengguna.

## Aturan wajib

- Semua halaman di area terproteksi memanggil `requireSession({ request, context })` di loader. Menyembunyikan UI di klien bukan proteksi.
- `redirectTo` selalu melewati `getSafeRedirect` (hanya path internal).
- Form sign-up, sign-in, reset password, dan kirim OTP memuat widget Turnstile dan mengirim token lewat header `x-captcha-response`.
- Organisasi aktif diambil dari `:slug` di URL, bukan dari sesi.
- `appDirectory: "src"` di `react-router.config.ts`; file route hanya merangkai fitur.
- Baca `DESIGN.md` sebelum tugas UI.

## Jebakan

- Mengimpor modul `*.server.ts` dari komponen → secret ikut bundel klien.
- QueryClient server dibagi antar-request → data pengguna bocor ke pengguna lain.
- `bunx shadcn@latest add` dijalankan di app ini → komponen tercecer. Jalankan dari `packages/design-system`.
- Login lewat fetch langsung dari browser ke `/api/auth/*` tanpa action → `Set-Cookie` tidak sampai ke domain app. Pakai action + Service Binding.

## Pengujian

- **Lingkungan:** dua project Vitest: `node` untuk `src/**/*.test.ts` (loader/action, `*.server`, util), `happy-dom` untuk komponen `src/**/*.test.tsx`.
- **Wajib diuji:** loader (401 → redirect `/sign-in?redirectTo=…`, error lain → ErrorBoundary), `getSafeRedirect` (tolak URL eksternal), validasi form, logika fitur.
- **Dilarang di test:** API nyata. Mock factory `src/lib/api-client.ts`.

## Rujukan

- `docs/react-router.md` — boundary, Service Binding, auth gate, pola data (diimpor di atas).
- `DESIGN.md` — panduan visual.
