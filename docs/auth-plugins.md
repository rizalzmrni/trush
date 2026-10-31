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
| `phoneNumber` | `sendOTP` memanggil `sendOtp()` dari `@trush/phone` (Twilio); OTP dibuat dan diverifikasi better-auth, bukan penyedia. |
| `openAPI` | `disableDefaultReference: true`: referensi bawaan `/api/auth/reference` memuat skrip Scalar tanpa pin dan inline script yang ditolak CSP api. Skema auth tersedia di `/api/auth/open-api/generate-schema`, dijaga `API_DOCS_ENABLED` sama dengan `/docs`. |
| `captcha` | Cloudflare Turnstile; lihat bagian di bawah. |
| `username`, `lastLoginMethod`, `multiSession` | Tanpa aturan khusus. |

## captcha (Cloudflare Turnstile)

- `provider: "cloudflare-turnstile"` dengan `secretKey` dari `TURNSTILE_SECRET_KEY`.
- `endpoints` ditulis eksplisit, karena opsi ini mengganti daftar bawaan: `/sign-up/email`, `/sign-in/email`, `/sign-in/username` (agar captcha tidak bisa dilewati lewat login username), `/request-password-reset`, `/phone-number/send-otp`, `/email-otp/send-verification-otp`. Endpoint plugin yang belum dipasang ditambahkan bersama plugin-nya (`phoneNumber` di B7, `emailOTP` di fase email). Cocokkan path dengan versi better-auth terpasang setiap kali upgrade.
- Klien mengirim token lewat header `x-captcha-response`; widget memakai `VITE_TURNSTILE_SITE_KEY`.
- Development dan e2e memakai kunci uji Cloudflare yang selalu lolos: site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA` (token `XXXX.DUMMY.TOKEN.XXXX`). Test jalur gagal memakai secret `2x0000000000000000000000000000000AA`.
- Staging dan production memakai widget masing-masing. Factory `@trush/env` menolak kunci uji saat `APP_ENV=production`.
- Widget memuat skrip dari `https://challenges.cloudflare.com`. Domain itu hanya masuk `script-src` dan `frame-src` CSP di halaman yang memuat form auth.
- Captcha melengkapi rate limit, bukan menggantikannya.
