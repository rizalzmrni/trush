# ADR 0001 — Penyedia SMS/WhatsApp: Twilio

Status: diterima · Tanggal: 2026-10-29 · Paket: `packages/phone`

## Konteks

Plugin `phoneNumber` better-auth butuh fungsi `sendOTP({ phoneNumber, code })`. better-auth sendiri yang membuat, menyimpan, dan memverifikasi OTP, jadi trush hanya butuh penyedia yang bisa mengirim pesan. Syaratnya: berjalan di Cloudflare Workers (`fetch`), punya MCP untuk agent, bisa diuji di development dan staging tanpa biaya atau risiko, dan mendukung SMS + WhatsApp di Indonesia.

## Perbandingan

| Kriteria | Twilio | TapTalk (SendTalk) | OCA |
| --- | --- | --- | --- |
| MCP | Resmi: Docs MCP hosted (read-only, tanpa kredensial) dan `@twilio-alpha/mcp` (PoC, mengeksekusi API) | Tidak ditemukan | Tidak ditemukan |
| Testing tanpa biaya | Test credentials + magic number untuk Messages; WhatsApp Sandbox | Tidak ada sandbox terdokumentasi | Tidak ada sandbox terdokumentasi publik |
| Kanal | SMS + WhatsApp (template) | WhatsApp | SMS, WhatsApp, IVR, email |
| Cocok dengan alur kode OTP better-auth | Ya (kirim kode) | Fitur verifikasinya memakai alur terbalik (pengguna mengirim pesan), tidak cocok dengan `sendOTP` | Belum bisa dinilai; dokumentasi API butuh login dashboard |
| Workers | REST + Basic auth lewat `fetch` | REST + header `API-Key` | Belum bisa dinilai |
| Kelebihan | Dokumentasi & tooling paling lengkap | Perusahaan lokal, tagihan IDR | Lokal (Telkom), omnichannel |

## Keputusan

Twilio **Programmable Messaging**, bukan Twilio Verify: test credentials dan magic number hanya berlaku untuk Messages, dan Verify tidak punya sandbox.

| Lingkungan | Driver | Perilaku |
| --- | --- | --- |
| Unit test / CI | `memory` | Pesan ditampung di memori, tanpa jaringan |
| Development | `log` | Kode OTP ditulis ke logger lokal |
| Development (uji integrasi) | `twilio-test` | Test credentials + `From` `+15005550006`, tanpa biaya, tanpa pesan nyata |
| Development (uji WhatsApp nyata) | `twilio` + WhatsApp Sandbox | Penerima harus join sandbox |
| Staging | `twilio` + `PHONE_ALLOWLIST` | Hanya nomor tim yang dikirimi |
| Produksi | `twilio` | Sender WhatsApp sendiri + Messaging Service SMS |

## Konsekuensi

- Produksi butuh WhatsApp Business sender milik trush dan template autentikasi yang disetujui Meta, serta pendaftaran sender SMS sesuai aturan Indonesia (cek panduan negara Twilio sebelum go-live).
- Harga dalam USD per pesan. Bila volume besar, TapTalk atau OCA dapat ditambah sebagai driver baru, karena antarmuka `sendOtp()` tidak terikat Twilio.
- Agent hanya diberi Docs MCP (`.mcp.json`). MCP eksekusi tidak dipasang karena butuh kredensial live akun Twilio.
