# ADR 0002 — Layanan pihak ketiga yang tidak dipakai (untuk saat ini)

Status: diterima · Tanggal: 2026-10-31

## Konteks

Boilerplate SaaS lain, umumnya yang dirancang untuk Vercel, sering memakai Upstash, Arcjet, Liveblocks, BaseHub, dan Knock. trush berjalan di Cloudflare Workers dan mendahulukan fitur stack yang ada serta layanan native Cloudflare.

## Keputusan

| Layanan | Fungsi | Keputusan | Pengganti di trush | Tinjau ulang bila |
| --- | --- | --- | --- | --- |
| Upstash | Rate limit berbasis Redis | Tidak dipakai | Binding Rate Limiting Workers (perkiraan, per lokasi) + rate limit better-auth di database | Butuh kuota global ketat; coba Durable Objects lebih dulu |
| Arcjet | Proteksi bot, shield, validasi email | Tidak dipakai | WAF dan proteksi bot Cloudflare + Turnstile (plugin `captcha`) | Serangan lolos dari WAF dan Turnstile |
| Liveblocks | Kolaborasi real-time | Tidak dipakai | Durable Objects bila dibutuhkan | Produk butuh editing bersama |
| BaseHub | CMS headless | Belum | Konten MDX di `apps/web` | Ada editor konten non-developer |
| Knock | Workflow notifikasi | Belum | Resend + Twilio langsung | Jenis notifikasi banyak, perlu preferensi pengguna atau inbox in-app |

## Konsekuensi

- Agent tidak menambahkan layanan di atas tanpa ADR baru yang menggantikan keputusan ini.
- Tidak ada secret, biaya, atau transfer data pribadi tambahan ke pihak ketiga tersebut.
