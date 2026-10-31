# packages/storage — Penyimpanan objek (Cloudflare R2)

Pembungkus Cloudflare R2 untuk trush: operasi lewat binding dan presigned URL untuk unggah/unduh langsung dari browser.

## Batas & kepemilikan

- **Isi:** helper binding R2 (`put`, `get`, `delete`), presigned URL lewat API S3-compatible (`aws4fetch`), konvensi key, entry `@trush/storage/testing` (`createMemoryStorage()` pengganti R2).
- **Dipakai oleh:** `apps/api`.
- **Tidak boleh:** validasi bisnis file (di service `api`), credential di kode.
- **Pemilik (tim agent):** `backend-engineer`
- **Risiko perubahan:** Menengah — salah akses membuka file privat.

## Aturan wajib

- Objek privat secara default; bucket publik hanya dengan keputusan lead.
- Presigned URL berumur pendek (5–15 menit) dan terikat satu key + `Content-Type`.
- Key berformat `<userId>/<domain>/<uuid>.<ext>`; nama file asli tidak dipakai sebagai key.
- Operasi server memakai binding; credential S3 hanya untuk menandatangani URL.

## Jebakan

- Binding R2 tidak bisa membuat presigned URL → pakai endpoint `<account>.r2.cloudflarestorage.com` + `aws4fetch`.
- Browser PUT ditolak → CORS bucket belum mengizinkan origin app. Atur CORS di R2.
- `Content-Type` saat unggah berbeda dari yang ditandatangani → 403.

## Pengujian

- **Lingkungan:** `@cloudflare/vitest-plugin` (binding R2 lokal)
- **Wajib diuji:** pembentukan key, parameter dan kedaluwarsa presigned URL, objek tidak ada menghasilkan error terdefinisi.
- **Dilarang di test:** bucket produksi.

## Rujukan

- `packages/env/CLAUDE.md` — credential dan nama bucket.
