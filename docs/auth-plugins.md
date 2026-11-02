# Plugin better-auth trush (packages/auth)

Diimpor oleh `packages/auth/CLAUDE.md`. Daftar izin plugin ada di file itu; dokumen ini menjelaskan cara memakai tiap plugin.

| Plugin | Catatan |
| --- | --- |
| `organization` | Organisasi aktif di app diambil dari `:slug` URL, bukan dari sesi. |
| `polar` | Hanya konfigurasi; klien Polar dan handler event dari `@trush/payments`. Satu-satunya endpoint webhook Polar ada di plugin ini. |
| `admin` | Route admin di api tetap melewati middleware sesi dan pemeriksaan peran. |
| `twoFactor` | QR code mengikuti pengecualian tercatat di `DESIGN.md`. |
| `haveIBeenPwned` | Memanggil API eksternal; wajib di-mock di test. |
| `emailOTP` | Hanya verifikasi email (`overrideDefaultEmailVerification`, `requireEmailVerification: true`, `sendOnSignUp`/`sendOnSignIn`, tanpa sesi otomatis). OTP dikirim lewat `@trush/email` di `waitUntil` (respons identik terdaftar/tidak; error hanya ke log), disimpan ter-hash, `allowedAttempts: 3`, `otpLength`, `expiresIn` 300 eksplisit. Login OTP, reset via OTP, ganti email, dan cek kode dimatikan lewat `disabledPaths` (404); `type` selain `email-verification` → 400 `INVALID_OTP_TYPE`. Kuota per alamat di `otp_rate_limit`: kirim ulang dan lupa password masing-masing 5/jam untuk semua alamat valid (429 `OTP_RATE_LIMITED`, tanpa oracle), plafon email verifikasi terkirim 10/jam (habis → dilewati diam-diam). Sesi baru untuk email belum terverifikasi dicabut di hook `after` (403 `EMAIL_NOT_VERIFIED`), termasuk login telepon dan 2FA. `/send-verification-email` dimatikan (404). verify-email: kuota 10 percobaan/jam per alamat untuk semua alamat valid (429 `OTP_RATE_LIMITED`). Kirim kode ke alamat tak terdaftar membuat baris OTP tiruan (umur sama, kode tidak pernah ada), sehingga verify-email berperilaku identik untuk alamat terdaftar/tidak. |
| `phoneNumber` | `sendOTP` memanggil `sendOtp()` dari `@trush/phone` (Twilio); OTP dibuat dan diverifikasi better-auth, bukan penyedia. `phoneNumberValidator` menolak nomor di luar negara/allowlist (400) sebelum OTP dibuat; kanal dari header `x-otp-channel` (`sms`, default WhatsApp). Telepon hanya tambahan akun: login OTP mati (`/phone-number/verify` hanya dengan `updatePhoneNumber: true` + sesi), `send-otp` tanpa sesi tidak mengirim, `phoneNumber` di `/sign-up/*` ditolak 400, dan `/sign-in/phone-number` hanya untuk nomor terverifikasi. `send-otp` dikirim sinkron (tanpa `backgroundTasks`): error Twilio menjadi 4xx berkode domain atau 502 `OTP_DELIVERY_FAILED`. OTP reset password dikirim lewat `waitUntil` agar respons nomor terdaftar/tidak identik; errornya hanya ke log. Kuota per nomor (5/jam) dan per pengguna (10/jam) di tabel `otp_rate_limit` → 429 `OTP_RATE_LIMITED` + `Retry-After` (mati di development). Step-up: setiap `send-otp` dengan sesi (tambah, ganti, kirim ulang) wajib `currentPassword` di body (403 `PASSWORD_REQUIRED`, 400 `INVALID_PASSWORD`, 429 `PASSWORD_ATTEMPTS_LIMITED` 10/jam per pengguna); password benar memberi grant (pengguna, nomor) 300 detik yang wajib ada saat `verify`, dan dihapus setelah verify sukses. Akun tanpa credential selalu ditolak (perlu step-up lain saat social login ditambah). Kuota step-up dicek sebelum kuota OTP, jadi kuota OTP per pengguna (sama-sama 10/jam) kini hanya lapisan cadangan yang sengaja dipertahankan; kuota per nomor tetap berlaku lintas akun. Opsi `allowedAttempts: 3`, `otpLength`, `expiresIn` ditulis eksplisit. Setelah nomor ditambah/diganti (`callbackOnVerification`): sesi lain dicabut dan email notifikasi dikirim. |
| `openAPI` | `disableDefaultReference: true`: referensi bawaan `/api/auth/reference` memuat skrip Scalar tanpa pin dan inline script yang ditolak CSP api. Skema auth tersedia di `/api/auth/open-api/generate-schema`, dijaga `API_DOCS_ENABLED` sama dengan `/docs`. |
| `captcha` | Cloudflare Turnstile; lihat bagian di bawah. |
| `username`, `lastLoginMethod`, `multiSession` | Tanpa aturan khusus. |

## Reset password (email)

- `sendResetPassword` mengirim tautan (template `password-reset`) lewat `waitUntil`; `resetPasswordTokenExpiresIn` 3600, `revokeSessionsOnPasswordReset: true`.
- `redirectTo` dari klien wajib URL absolut http(s) ber-origin di `CORS_ORIGINS`, ditegakkan hook `before` (403 `INVALID_REDIRECT_URL` sebelum token dibuat, tanpa email dan tanpa kuota). Alasan: `originCheck` better-auth melewatkan request tanpa cookie, sehingga penyerang bisa meminta reset untuk korban dengan `redirectTo` ke domain miliknya dan menerima token saat korban membuka tautan sah.
- Lapisan kedua: `GET /reset-password/:token` dengan `callbackURL` di luar `CORS_ORIGINS` → 403 tanpa redirect. Token tidak sah dialihkan ke `redirectTo?error=INVALID_TOKEN`.

## captcha (Cloudflare Turnstile)

- `provider: "cloudflare-turnstile"` dengan `secretKey` dari `TURNSTILE_SECRET_KEY`.
- `endpoints` ditulis eksplisit, karena opsi ini mengganti daftar bawaan: `/sign-up/email`, `/sign-in/email`, `/sign-in/username` (agar captcha tidak bisa dilewati lewat login username), `/request-password-reset`, `/phone-number/send-otp`, `/phone-number/request-password-reset`, `/sign-in/phone-number`, `/email-otp/send-verification-otp`. Endpoint plugin yang belum dipasang ditambahkan bersama plugin-nya. Cocokkan path dengan versi better-auth terpasang setiap kali upgrade.
- Klien mengirim token lewat header `x-captcha-response`; widget memakai `VITE_TURNSTILE_SITE_KEY`.
- Development dan e2e memakai kunci uji Cloudflare yang selalu lolos: site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA` (token `XXXX.DUMMY.TOKEN.XXXX`). Test jalur gagal memakai secret `2x0000000000000000000000000000000AA`.
- Staging dan production memakai widget masing-masing. Factory `@trush/env` menolak kunci uji saat `APP_ENV=production`.
- Widget memuat skrip dari `https://challenges.cloudflare.com`. Domain itu hanya masuk `script-src` dan `frame-src` CSP di halaman yang memuat form auth.
- Captcha melengkapi rate limit, bukan menggantikannya.
