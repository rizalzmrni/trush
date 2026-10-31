# packages/phone — Pengiriman OTP lewat SMS & WhatsApp (Twilio)

Pengirim pesan telepon trush di atas Twilio Programmable Messaging, dipakai plugin `phoneNumber` better-auth. OTP dibuat dan diverifikasi better-auth; paket ini hanya mengirim.

## Batas & kepemilikan

- **Isi:** `createPhoneSender(env)` dengan driver `memory`, `log`, `twilio-test`, `twilio`; `sendOtp({ phone, code, channel })`; normalisasi E.164 (`libphonenumber-js`); guard negara dan allowlist.
- **Dipakai oleh:** `@trush/auth` (plugin `phoneNumber`).
- **Tidak boleh:** membuat/menyimpan OTP, SDK `twilio` (pakai `fetch` ke REST API), pesan marketing atau broadcast.
- **Pemilik (tim agent):** `backend-engineer`
- **Risiko perubahan:** Berisiko — biaya per pesan dan sasaran SMS pumping.

## Aturan wajib

- Driver dipilih dari env `PHONE_DRIVER`: `memory` (test, dan wajib bila `E2E=true`), `log` (development), `twilio-test` (test credentials + magic number, tanpa biaya), `twilio` (staging/produksi). Selain `twilio` ditolak bila `APP_ENV=production`.
- Nomor dinormalisasi ke E.164 sebelum dikirim (`08…` → `+628…`); negara di luar `PHONE_ALLOWED_COUNTRIES` (awal: `ID`) ditolak.
- Staging memakai `PHONE_ALLOWLIST` (nomor tim); nomor lain ditolak tanpa memanggil Twilio.
- Kanal default WhatsApp: template autentikasi `TWILIO_WHATSAPP_OTP_CONTENT_SID` lewat `ContentSid` + `ContentVariables`. SMS lewat `TWILIO_MESSAGING_SERVICE_SID`; UI menyediakan "kirim ulang via SMS".
- Auth REST memakai API Key (`TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`) + `TWILIO_ACCOUNT_SID`, bukan Auth Token utama. Semua var di skema api `@trush/env`.
- Kode OTP tidak pernah di-log, kecuali oleh driver `log` di development.

## Jebakan

- Memakai Twilio Verify → test credentials tidak berlaku dan tidak ada sandbox. Paket ini sengaja memakai Messaging.
- Magic number `+15005550006` sebagai pengirim hanya berlaku dengan test credentials; dengan kredensial live permintaan gagal.
- Pesan WhatsApp di luar template autentikasi yang disetujui Meta → ditolak. Isi pesan OTP diatur di template, bukan di kode.
- Respons 201 dari Twilio berarti masuk antrean, bukan terkirim. Status akhir datang lewat status callback.

## Pengujian

- **Lingkungan:** Node
- **Wajib diuji:** normalisasi E.164, tolak negara/nomor di luar allowlist, pemilihan driver per `APP_ENV` (tolak selain `twilio` di production), payload REST Twilio untuk SMS dan WhatsApp, pemetaan error Twilio ke error domain.
- **Dilarang di test:** Twilio live. Pakai driver `memory` dan mock `fetch`.

## Rujukan

- `docs/adr/0001-phone-provider.md` — alasan memilih Twilio.
- `packages/auth/CLAUDE.md` — plugin `phoneNumber`.
