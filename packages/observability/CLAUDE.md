# packages/observability — Logging & error (LogTape, BetterStack, PostHog)

Logger terstruktur trush berbasis LogTape (ke Workers Logs + BetterStack) dan pelaporan error ke PostHog Error Tracking, untuk sisi server.

## Batas & kepemilikan

- **Isi:** entry `@trush/observability/logger` (`src/logger.ts`: konfigurasi LogTape, sink console JSON, sink BetterStack, redaksi) dan `@trush/observability/posthog` (`captureError()`, `capture()`).
- **Dipakai oleh:** `apps/api` dan paket backend. Analitik dan error frontend lewat `@trush/analytics`.
- **Tidak boleh:** logika bisnis, secret di kode, `console.*` di luar `src/logger.ts`.
- **Pemilik (tim agent):** `backend-engineer`
- **Risiko perubahan:** Menengah — log yang salah bisa membocorkan data.

## Aturan wajib

- Library: LogTape (`@logtape/logtape` + `@logtape/redaction`). Alasan: tanpa dependensi, resmi mendukung Cloudflare Workers, redaksi tersedia. Pino tidak dipakai karena transport-nya bergantung pada worker thread dan stream Node.
- `console.*` HANYA di `src/logger.ts` (sink) dan `src/logger.test.ts`; oxlint `no-console` hanya membebaskan dua file itu. Kode lain memakai `getLogger(["trush", "<paket>"])`.
- Redaksi: `password`, `token`, `secret`, `authorization`, `cookie`, email, nomor kartu, didefinisikan dalam satu daftar.
- Satu baris log = satu objek JSON (level, pesan, `requestId`, properti) agar Workers Logs mengindeks field-nya.
- `requestId` dari header `cf-ray` (atau dibuat), dipasang sebagai konteks per request (`contextLocalStorage` dengan `AsyncLocalStorage`).
- Sink BetterStack mengirim batch lewat `ctx.waitUntil`; sink gagal tidak boleh menggagalkan request. Level dari `LOG_LEVEL`; `debug` ditolak bila `APP_ENV=production`.
- PostHog server lewat HTTP capture API dengan `fetch` + `waitUntil`, tanpa SDK Node. Error dikirim sebagai `$exception` dengan `handled: false` dan `distinctId` dari sesi bila ada.

## Jebakan

- `configure()` LogTape dipanggil tiap request → konfigurasi ganda/error. Konfigurasi sekali per isolate (pakai guard); `reset` hanya di test.
- Sink console dipindah ke file lain → lint `no-console` gagal. Tetap di `src/logger.ts`.
- PII digabung ke pesan (`"user " + email`) → lolos redaksi. Kirim sebagai properti terstruktur.

## Pengujian

- **Lingkungan:** Node
- **Wajib diuji:** redaksi (termasuk bersarang), bentuk JSON, sink gagal tidak melempar error, `requestId` ikut di setiap log.
- **Dilarang di test:** BetterStack/PostHog nyata. Mock transport.
