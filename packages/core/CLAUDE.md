# packages/core — Logika domain & skema bersama

Logika domain murni trush (tanpa I/O) dan skema Zod yang dipakai lintas app/paket. Sumber kebenaran aturan bisnis dan bentuk data.

## Batas & kepemilikan

- **Isi:** fungsi domain murni, skema Zod bersama (request/response, entitlement, validasi), tipe turunan.
- **Dipakai oleh:** `apps/api`, `apps/app`, `apps/web`, `@trush/payments`, dan paket lain yang butuh aturan/bentuk data bersama.
- **Tidak boleh:** I/O apa pun (jaringan, DB, fs, env), dependensi framework (React, Hono), API khusus Node (`Buffer`, `node:*`).
- **Pemilik (tim agent):** `backend-engineer`
- **Risiko perubahan:** Menengah — perubahan skema memengaruhi backend dan frontend sekaligus.

## Aturan wajib

- Fungsi deterministik tanpa I/O. Butuh data eksternal (waktu, id acak)? Terima sebagai argumen. Alasan: bisa jalan di server dan browser, mudah diuji.
- Tipe diturunkan dari skema (`z.infer`), tidak dideklarasikan ganda.
- Perubahan skema yang dipakai frontend: catat di tabel "Kontrak" `STATUS.md` lewat lead dan kirim pesan ke `frontend-engineer` sebelum dipakai.
- Breaking change pada skema diberi nama baru atau field opsional dulu, tidak langsung mengubah bentuk lama.

## Jebakan

- Mengimpor `@trush/db`, `@trush/env`, atau modul server → paket tak bisa dipakai di klien. Jaga bebas dependensi.
- Tipe tulis-tangan di samping skema → tipe dan validasi menyimpang.

## Pengujian

- **Lingkungan:** Node
- **Wajib diuji:** aturan domain (kasus tepi), parse skema (valid dan tolak), invarian bisnis.
- **Dilarang di test:** jaringan, DB, fs. Paket ini memang tanpa I/O.

## Rujukan

- `packages/payments/CLAUDE.md` — konsumen model entitlement.
