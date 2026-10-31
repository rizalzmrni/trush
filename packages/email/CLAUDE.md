# packages/email — Template & pengiriman email (React Email + Resend)

Template React Email dan fungsi kirim Resend untuk trush. Template dipratinjau oleh `apps/email` (milik `frontend-engineer`).

## Batas & kepemilikan

- **Isi:** template (`src/templates/*.tsx`), tema (`src/theme.ts`), fungsi `send<Nama>()` per template, factory klien Resend.
- **Dipakai oleh:** `apps/api` dan `@trush/auth` (OTP), `apps/email` (preview).
- **Tidak boleh:** keputusan kapan email dikirim (di pemanggil), HTML manual, warna/font yang tidak berasal dari `DESIGN.md`.
- **Pemilik (tim agent):** `backend-engineer`; perubahan visual dikoordinasikan dengan `frontend-engineer`.
- **Risiko perubahan:** Menengah — email terkirim tidak bisa ditarik.

## Aturan wajib

- Gaya visual mengikuti `DESIGN.md`. Warna diambil dari tabel hex di bagian "Pengecualian tercatat" `DESIGN.md`, ukuran dalam px, disimpan di `src/theme.ts`; template hanya memakai `theme`. Alasan: klien email tidak mendukung CSS variable maupun oklch.
- Setiap template menetapkan `<Template>.PreviewProps` berisi data contoh palsu.
- Fungsi kirim menerima props terketik, merender template, lalu memanggil Resend dengan `idempotencyKey` (mis. `password-reset/<userId>/<tokenId>`).
- Alamat pengirim dari env; domainnya harus terverifikasi di Resend.
- Bila `E2E=true` (hanya development), kirim memakai driver `memory` agar email dibaca e2e lewat `/__e2e/outbox`, bukan Resend.

## Jebakan

- Menyalin nilai oklch dari `globals.css` → warna hilang di banyak klien email. Pakai tabel hex di `DESIGN.md`; nilai yang belum ada di tabel diminta ke lead.
- Font kustom atau dark mode diandalkan → banyak klien email mengabaikannya. Sertakan fallback web-safe dan pastikan kontras di latar terang.
- Kelas Tailwind tanpa pembungkus `<Tailwind>` React Email → gaya hilang.
- Mengirim ke alamat sungguhan saat dev → pakai `delivered@resend.dev`.

## Prosedur

### Menambah template email

1. Buat `src/templates/<nama>.tsx` dengan gaya dari `theme` + `PreviewProps`.
2. Tambah `send<Nama>()` dengan props terketik dan `idempotencyKey`.
3. Ekspor dari `src/index.ts`, cek tampilan di `apps/email`.
4. Kabari `qa-tester` untuk test render.

## Pengujian

- **Lingkungan:** Node
- **Wajib diuji:** render tiap template dengan `PreviewProps`, props ke konten, panggilan kirim membawa idempotency key.
- **Dilarang di test:** Resend nyata. Mock SDK.

## Rujukan

- `DESIGN.md` — sumber token visual.
- `packages/env/CLAUDE.md` — `RESEND_API_KEY`, alamat pengirim.
