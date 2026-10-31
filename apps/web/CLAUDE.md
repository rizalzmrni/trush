# apps/web — Situs marketing (React Router SSR)

Situs publik trush (landing, pricing, blog): React Router SSR di Workers. Prioritas: performa, SEO, konversi.

@../../docs/react-router.md

## Batas & kepemilikan

- **Isi:** halaman marketing publik; section di `src/features/<section>/` (`appDirectory: "src"`).
- **Dipakai oleh:** pengunjung anonim; tidak diimpor paket lain.
- **Tidak boleh:** fitur yang butuh login (ke `apps/app`), akses DB, secret di kode klien.
- **Pemilik (tim agent):** `frontend-engineer`
- **Risiko perubahan:** Kecil — tanpa data pengguna.

## Aturan wajib

- Utamakan SSR dan konten statis; hindari data fetching klien yang tidak perlu.
- Setiap halaman punya `meta` lewat `@trush/seo`; sitemap dan JSON-LD juga dari paket itu. Tidak menulis `<meta>` manual.
- Google Analytics dari `@trush/analytics`; hormati persetujuan cookie.
- Halaman marketing tidak memanggil auth gate, kecuali halaman itu menampilkan status login.
- Baca `DESIGN.md` sebelum tugas UI.

## Jebakan

- Header/footer diduplikasi dengan `apps/app` → pindahkan ke design-system.
- URL `apps/app` (login, daftar) ditulis keras → ambil dari env publik `VITE_APP_URL`.

## Pengujian

- **Lingkungan:** happy-dom
- **Wajib diuji:** render SSR halaman utama, meta/canonical/JSON-LD, link internal valid.
- **Dilarang di test:** jaringan nyata.

## Rujukan

- `docs/react-router.md` — boundary dan SEO (diimpor di atas).
- `DESIGN.md` — panduan visual.
