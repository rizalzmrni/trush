# packages/payments — Pembayaran (Polar)

Domain pembayaran trush di atas Polar (Merchant of Record): klien SDK, handler event, dan pemetaan ke entitlement. Checkout, portal, dan webhook berjalan lewat plugin `polar` di `@trush/auth`, yang memakai paket ini.

## Batas & kepemilikan

- **Isi:** factory klien `@polar-sh/sdk`, handler event webhook (mis. `onOrderPaid`, `onSubscriptionActive`), pemetaan event ke entitlement, query status langganan.
- **Dipakai oleh:** `@trush/auth` (plugin `polar`), `apps/api` (status langganan).
- **Tidak boleh:** endpoint webhook sendiri, mengimpor `@trush/auth` (siklus dependensi), UI pembayaran, data kartu, aturan entitlement murni (ke `@trush/core`).
- **Pemilik (tim agent):** `backend-engineer`
- **Risiko perubahan:** Berisiko — menyangkut uang dan akses berbayar.

## Aturan wajib

- Hanya ada SATU endpoint webhook Polar: `webhooks({ secret, ... })` di plugin `polar`, yang memverifikasi tanda tangan. Paket ini hanya menyediakan handler.
- Handler idempoten: upsert berdasarkan id entitas Polar (order/subscription), bukan insert buta. Event yang sama dua kali menghasilkan state yang sama.
- Handler melempar error bila penyimpanan gagal agar Polar mengirim ulang; jangan menelan error.
- Status berbayar hanya dari event Polar terverifikasi, tidak dari redirect sukses atau data klien.
- `server` Polar mengikuti `APP_ENV`: `sandbox` di development/staging, `production` hanya di production. Product ID dari env.

## Jebakan

- Menambah route webhook di `apps/api` → event diproses dua kali dengan secret terpisah. Semua event lewat plugin.
- Pelanggan Polar dibuat manual → duplikat. Pakai `createCustomerOnSignUp` di plugin.
- Product ID ditulis keras → berbeda antara sandbox dan produksi. Ambil dari env.

## Pengujian

- **Lingkungan:** Node
- **Wajib diuji:** pemetaan event ke entitlement, idempotensi (event sama dua kali), error dilempar saat penyimpanan gagal.
- **Dilarang di test:** API Polar nyata. Pakai payload fixture.

## Rujukan

- `packages/auth/CLAUDE.md` — konfigurasi plugin `polar`.
- `packages/core/CLAUDE.md` — model entitlement.
