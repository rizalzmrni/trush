# packages/seo — Metadata, sitemap, dan JSON-LD

Helper SEO trush untuk export `meta` React Router, builder JSON-LD bertipe, dan generator sitemap/robots yang dipakai resource route app.

## Batas & kepemilikan

- **Isi:** `createMeta()` (title, description, canonical, Open Graph, Twitter), builder JSON-LD (Organization, WebSite, SoftwareApplication, FAQPage, BreadcrumbList) + komponen `<JsonLd>`, `createSitemap()`, `createRobots()`.
- **Dipakai oleh:** `apps/web` (utama), `apps/app` (title + `noindex`).
- **Tidak boleh:** fetch data, membaca env sendiri, copy teks halaman (milik app).
- **Pemilik (tim agent):** `frontend-engineer`
- **Risiko perubahan:** Kecil — tanpa data pengguna, tetapi salah konfigurasi bisa menghapus situs dari indeks mesin pencari.

## Aturan wajib

- `siteUrl` dan mode lingkungan diterima sebagai argumen dari app, tidak dibaca dari env di paket ini.
- Canonical dan `og:image` selalu URL absolut.
- Title berformat `<halaman> · trush`, maksimal 60 karakter; description 70–160 karakter.
- Bila `APP_ENV` (diteruskan app) bukan `production`, semua halaman `noindex` dan `robots.txt` menolak semua crawler. Halaman `apps/app` selalu `noindex`.
- Sitemap hanya memuat route publik yang boleh diindeks, dengan `lastmod` ISO.

## Jebakan

- `meta` route anak di React Router menggantikan `meta` induk, tidak menggabungkannya → default (og, canonical) hilang. `createMeta()` selalu mengisi default lengkap.
- JSON-LD tanpa escape `<` → konten bisa menutup tag script lebih awal (XSS). Serialisasi lewat `<JsonLd>`, yang meng-escape `<`.
- `og:image` relatif → diabaikan crawler dan pratinjau media sosial.

## Pengujian

- **Lingkungan:** Node
- **Wajib diuji:** `createMeta()` (URL absolut, batas panjang, `noindex` di luar produksi), escape JSON-LD, XML sitemap valid, isi `robots.txt` per lingkungan.
- **Dilarang di test:** jaringan.

## Rujukan

- `apps/web/CLAUDE.md` — pemakaian di situs marketing.
- `docs/react-router.md` — bagian SEO.
