# Plugin better-auth trush (packages/auth)

Diimpor oleh `packages/auth/CLAUDE.md`. Daftar izin plugin ada di file itu; dokumen ini menjelaskan cara memakai tiap plugin.

| Plugin | Catatan |
| --- | --- |
| `organization` | Organisasi aktif di app diambil dari `:slug` URL, bukan dari sesi. |
| `polar` | Hanya konfigurasi; klien Polar dan handler event dari `@trush/payments`. Satu-satunya endpoint webhook Polar ada di plugin ini. |
| `admin` | Route admin di api tetap melewati middleware sesi dan pemeriksaan peran. |
| `twoFactor` | QR code mengikuti pengecualian tercatat di `DESIGN.md`. |
| `haveIBeenPwned` | Memanggil API eksternal; wajib di-mock di test. |
| `emailOTP` | OTP dikirim lewat `@trush/email`. |
| `phoneNumber` | `sendOTP` memanggil `sendOtp()` dari `@trush/phone` (Twilio); OTP dibuat dan diverifikasi better-auth, bukan penyedia. `phoneNumberValidator` menolak nomor di luar negara/allowlist (400) sebelum OTP dibuat; kanal dari header `x-otp-channel` (`sms`, default WhatsApp). Telepon hanya tambahan akun: login OTP mati (`/phone-number/verify` hanya dengan `updatePhoneNumber: true` + sesi), `send-otp` tanpa sesi tidak mengirim, `phoneNumber` di `/sign-up/*` ditolak 400, dan `/sign-in/phone-number` hanya untuk nomor terverifikasi. `send-otp` dikirim sinkron (tanpa `backgroundTasks`): error Twilio menjadi 4xx berkode domain atau 502 `OTP_DELIVERY_FAILED`. OTP reset password dikirim lewat `waitUntil` agar respons nomor terdaftar/tidak identik; errornya hanya ke log. Kuota per nomor (5/jam) dan per pengguna (10/jam) di tabel `otp_rate_limit` → 429 `OTP_RATE_LIMITED` + `Retry-After` (mati di development). |
| `openAPI` | `disableDefaultReference: true`: referensi bawaan `/api/auth/reference` memuat skrip Scalar tanpa pin dan inline script yang ditolak CSP api. Skema auth tersedia di `/api/auth/open-api/generate-schema`, dijaga `API_DOCS_ENABLED` sama dengan `/docs`. |
| `captcha` | Cloudflare Turnstile; lihat bagian di bawah. |
| `username`, `lastLoginMethod`, `multiSession` | Tanpa aturan khusus. |

## captcha (Cloudflare Turnstile)

- `provider: "cloudflare-turnstile"` dengan `secretKey` dari `TURNSTILE_SECRET_KEY`.
- `endpoints` ditulis eksplisit, karena opsi ini mengganti daftar bawaan: `/sign-up/email`, `/sign-in/email`, `/sign-in/username` (agar captcha tidak bisa dilewati lewat login username), `/request-password-reset`, `/phone-number/send-otp`, `/phone-number/request-password-reset`, `/sign-in/phone-number`, `/email-otp/send-verification-otp`. Endpoint plugin yang belum dipasang ditambahkan bersama plugin-nya (`emailOTP` di fase email). Cocokkan path dengan versi better-auth terpasang setiap kali upgrade.
- Klien mengirim token lewat header `x-captcha-response`; widget memakai `VITE_TURNSTILE_SITE_KEY`.
- Development dan e2e memakai kunci uji Cloudflare yang selalu lolos: site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA` (token `XXXX.DUMMY.TOKEN.XXXX`). Test jalur gagal memakai secret `2x0000000000000000000000000000000AA`.
- Staging dan production memakai widget masing-masing. Factory `@trush/env` menolak kunci uji saat `APP_ENV=production`.
- Widget memuat skrip dari `https://challenges.cloudflare.com`. Domain itu hanya masuk `script-src` dan `frame-src` CSP di halaman yang memuat form auth.
- Captcha melengkapi rate limit, bukan menggantikannya.
