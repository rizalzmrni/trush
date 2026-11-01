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
- Rate limit: `rateLimit: { enabled: APP_ENV !== "development", storage: "database" }` + `customRules` ketat untuk `/sign-in/*`, `/phone-number/*`, `/email-otp/*`, `/two-factor/*`. Penyimpanan default (memori) tidak berlaku lintas isolate Workers.

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
  - `body.phoneNumber` diganti E.164.
- `/phone-number/send-otp` tanpa sesi TIDAK PERNAH mengirim; respons tetap 200 "code sent", jadi status maupun waktu tidak membedakan nomor. `/phone-number/request-password-reset` mengirim untuk nomor terdaftar saja (respons sama `{ status: true }`), tetapi waktunya masih berbeda (panggilan penyedia hanya untuk nomor terdaftar). Kanal dari header `x-otp-channel: sms` (default WhatsApp).
- Jangan isi `advanced.backgroundTasks`: plugin `phoneNumber` lalu mengirim OTP di latar dan error Twilio tidak sampai ke pengguna. Kirim OTP sinkron; `PhoneError` → 400/422/429 berkode domain, `PROVIDER_*` → 502 `OTP_DELIVERY_FAILED`.

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

- `docs/auth-plugins.md` — cara pakai tiap plugin (diimpor di atas).
- `packages/db/CLAUDE.md` — migrasi dan `newId()`.
- `packages/payments/CLAUDE.md` — handler event Polar.
