# packages/auth — Autentikasi (better-auth)

Konfigurasi better-auth server dan klien trush: sesi, akun, plugin, middleware untuk `apps/api`, dan helper guard untuk `apps/app`.

@../../docs/auth-plugins.md

## Batas & kepemilikan

- **Isi:** dua entry: server `@trush/auth` (factory `createAuth(env)`, adapter Drizzle, middleware Hono) dan klien `@trush/auth/client` (+ client plugin).
- **Dipakai oleh:** `apps/api` (entry server); `apps/app` dan `apps/web` hanya entry `@trush/auth/client`.
- **Tidak boleh:** logika bisnis non-auth, koneksi DB sendiri, plugin di luar daftar izin.
- **Pemilik (tim agent):** `backend-engineer`
- **Risiko perubahan:** Berisiko — keamanan akun.

## Aturan wajib

- Plugin yang diizinkan HANYA: `organization`, `polar` (`@polar-sh/better-auth`), `admin`, `twoFactor`, `username`, `haveIBeenPwned`, `emailOTP`, `lastLoginMethod`, `multiSession`, `phoneNumber`, `openAPI`, `captcha` (Cloudflare Turnstile). Plugin lain butuh persetujuan user. Plugin yang punya sisi klien wajib dipasangi client plugin. Cara pakai tiap plugin ada di `docs/auth-plugins.md`.
- ID memakai UUIDv7: `advanced.database.generateId: () => newId()`, dengan `newId` dari `@trush/db`. Kolom id tabel auth bertipe `text`.
- Tabel auth SELALU dihasilkan CLI `bun x auth@latest generate` (prosedur di bawah), tidak ditulis atau disunting tangan.
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `trustedOrigins` hanya dari env.
- Cookie `httpOnly` + `secure`; lintas subdomain lewat `advanced.crossSubDomainCookies` dengan domain dari env.
- Instance dibuat per request lewat `createAuth(env)`; adapter `drizzleAdapter(db, { provider: "pg" })`.
- Rate limit: `rateLimit: { enabled: APP_ENV !== "development", storage: "database" }` + `customRules` ketat untuk `/sign-in/*`, `/phone-number/*`, `/email-otp/*`, `/two-factor/*`, `/change-password` (5/menit: butuh password saat ini, jadi oracle brute-force bila longgar). Penyimpanan default (memori) tidak berlaku lintas isolate Workers.
- `customRules`: better-auth memakai aturan PERTAMA yang cocok menurut urutan kunci, jadi aturan spesifik ditulis sebelum wildcard-nya. `/phone-number/verify` 10/menit per IP (di atas `/phone-number/*` 3/menit untuk `send-otp` dan `request-password-reset`); tebakan kode tetap dibatasi plugin 3x per OTP (`allowedAttempts: 3`, `otpLength: PHONE_OTP_LENGTH`, `expiresIn` ditulis eksplisit: default better-auth bisa berubah saat upgrade).

## Jebakan

- `betterAuth({...})` di scope modul → secret belum ada di Workers. Pakai factory.
- CLI mencari `auth.ts` statis → sediakan `src/auth.cli.ts` (env dev, plugin sama persis dengan factory) dan berikan lewat `--config`.
- `auth@latest` lebih baru dari `better-auth` terpasang → skema tidak cocok. Naikkan `better-auth` ke versi yang sama sebelum generate.
- Test dengan PGlite: `createAuth({ db })` menerima `AnyDatabase`, jadi `createTestDb().db` bisa dipakai langsung. Mock `fetch` untuk Turnstile (`challenges.cloudflare.com`) dan HIBP (`api.pwnedpasswords.com`).
- `useSecureCookies` → nama cookie sesi `__Secure-better-auth.session_token`.
- `phoneNumber` (`src/phone.ts`): telepon hanya tambahan akun; login OTP dan daftar lewat telepon MATI (`signUpOnVerification` sengaja tidak diisi). Hook `before`:
  - `/sign-up/*` dengan `phoneNumber` → 400 `FIELD_NOT_ALLOWED`, apa pun nomornya (tanpa oracle nomor terpakai). `schema.user.fields` plugin hanya mengganti nama kolom, jadi `input: false` tidak bisa dipasang di sana.
  - `/phone-number/verify` sah hanya dengan `updatePhoneNumber: true` + sesi. Tanpa itu (termasuk `disableSession`) → 400 `INVALID_OTP` sebelum kode diperiksa, jadi tidak ada sesi, tidak melewati 2FA, bukan oracle kode. Tanpa sesi → 401 sebelum kode dikonsumsi.
  - `/sign-in/phone-number` (tetap ikut 2FA) hanya untuk nomor terverifikasi; nomor tak terdaftar/belum terverifikasi tetap meng-hash password lalu 401 identik dengan password salah. `requireVerification` plugin sengaja tidak dipakai: ia membalas `PHONE_NUMBER_NOT_VERIFIED` sebelum cek password (oracle).
  - `body.phoneNumber` diganti E.164; `currentPassword` dibuang dari body HANYA di `/phone-number/*` (`/change-password` memakai field bernama sama).
- `/phone-number/send-otp` tanpa sesi TIDAK PERNAH mengirim; respons tetap 200 "code sent", jadi status maupun waktu tidak membedakan nomor. `/phone-number/request-password-reset` mengirim untuk nomor terdaftar saja, lewat `waitUntil` (opsi `waitUntil` `createAuth`), jadi respons dan waktunya sama untuk nomor terdaftar/tidak; error penyedia di jalur ini hanya ke log (`onPasswordResetOtpError`), tidak ke pengguna. Kanal dari header `x-otp-channel: sms` (default WhatsApp).
- Kuota OTP per pengguna (`send-otp` dengan sesi, 10/jam) dan per nomor (`send-otp` + `request-password-reset`, 5/jam) di tabel `otp_rate_limit` (`src/otp-rate-limit.ts`), 429 `OTP_RATE_LIMITED` + `Retry-After`. Bukan tabel `rate_limit` better-auth: ia memangkas baris lebih tua dari jendela terpanjang aturannya (60 detik). Hanya nomor yang lolos normalisasi + `canSendTo` yang dihitung (nomor tidak valid → 400 validator tanpa memakan kuota). Reset password dihitung untuk semua nomor valid, terdaftar atau tidak (tanpa oracle); `send-otp` tanpa sesi tidak dihitung. Mati di development, seperti rate limit IP.
- Step-up nomor (B11, `src/phone-step-up.ts`): SETIAP `send-otp` dengan sesi (tambah nomor pertama, ganti, kirim ulang) wajib `currentPassword` di body, karena nomor membuka reset password lewat telepon. Urutan: tanpa password → 403 `PASSWORD_REQUIRED`; kuota percobaan per pengguna 10/jam (`otp_rate_limit`, benar/salah dihitung) → 429 `PASSWORD_ATTEMPTS_LIMITED`; salah → 400 `INVALID_PASSWORD`; semuanya sebelum OTP dibuat dan sebelum kuota OTP. Password dicek `ctx.context.password.checkPassword` (akun tanpa credential, mis. social login nanti → selalu `INVALID_PASSWORD`, fail closed; butuh step-up alternatif saat social login ditambah). Password benar → grant (userId, nomor E.164) di tabel `verification`, umur = umur OTP, menggantikan grant lama. `verify` (`updatePhoneNumber`) selalu butuh grant cocok, tanpa itu → 403 `PASSWORD_REQUIRED` sebelum kode diperiksa; grant dihapus hook `after` hanya saat verify sukses. Alasan grant, bukan password di verify: OTP tidak terikat user (penyerang bisa meminta OTP lewat akun lain), dan verify tanpa captcha akan jadi oracle password.
- Jangan isi `advanced.backgroundTasks`: berlaku global, sehingga OTP tambah nomor ikut dikirim di latar dan error Twilio tidak sampai ke pengguna. `sendOTP` sinkron (hanya reset password yang memakai `waitUntil` sendiri); `PhoneError` → 400/422/429 berkode domain, `PROVIDER_*` → 502 `OTP_DELIVERY_FAILED`.

## Prosedur

### Menambah plugin / opsi yang memengaruhi skema

1. Pastikan plugin ada di daftar izin; ubah factory, `auth.cli.ts`, dan klien.
2. `bun run auth:generate` (di `packages/auth`; script mem-pin versi CLI `auth@` = `better-auth` terpasang, naikkan keduanya bersamaan).
3. Tambahkan tabel baru sebagai ekspor bernama di `packages/db/src/schema/index.ts`, lalu lanjutkan prosedur migrasi di `packages/db/CLAUDE.md`.

## Pengujian

- **Lingkungan:** Node
- **Wajib diuji:** sesi (buat, validasi, kedaluwarsa), tolak tanpa sesi, atribut cookie, ID berformat UUIDv7, plugin aktif sama dengan daftar izin, endpoint ber-captcha menolak request tanpa token.
- **Dilarang di test:** OAuth, email, SMS, HIBP, dan Turnstile nyata (pakai kunci uji Turnstile).

## Rujukan

- `packages/db/CLAUDE.md` — migrasi dan `newId()`.
- `packages/payments/CLAUDE.md` — handler event Polar.
