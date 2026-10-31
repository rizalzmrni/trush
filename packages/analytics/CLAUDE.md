# packages/analytics — Google Analytics & PostHog (klien)

Analitik sisi browser trush: Google Analytics untuk situs marketing dan PostHog untuk analitik produk serta error klien. Server memakai `@trush/observability`.

## Batas & kepemilikan

- **Isi:** loader GA dengan Consent Mode, init `posthog-js`, katalog event bertipe (`src/events.ts`), `track()`, `identify()`/`reset()`, `captureException()` klien, `getConsent()`/`setConsent()`, provider React.
- **Dipakai oleh:** `apps/web` (GA, PostHog opsional), `apps/app` (PostHog).
- **Tidak boleh:** pengiriman dari server (ke `@trush/observability`), PII di properti event, key rahasia.
- **Pemilik (tim agent):** `frontend-engineer`
- **Risiko perubahan:** Menengah — salah konfigurasi melanggar privasi atau menghilangkan data analitik.

## Aturan wajib

- Hormati persetujuan cookie: Consent Mode default `denied`; GA dan PostHog tidak menyimpan cookie sebelum pengguna setuju.
- Status persetujuan disimpan di cookie first-party `trush_consent` agar SSR tahu statusnya tanpa kedip. Banner-nya komponen presentasional di `@trush/design-system`, dirangkai di app.
- Nama event hanya dari katalog `src/events.ts` (format `object_action`, mis. `checkout_started`) dengan properti bertipe; tidak ada string bebas.
- Tanpa PII: `identify()` hanya memakai id pengguna (UUIDv7), tidak memakai email atau nama.
- Inisialisasi hanya di browser (provider/`useEffect`), tidak saat SSR. Tanpa key di env, semua fungsi menjadi no-op.
- Env klien: `VITE_GA_MEASUREMENT_ID`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` lewat `@trush/env`.

## Jebakan

- Lupa `reset()` saat logout → event pengguna berikutnya tergabung ke orang sebelumnya.
- Memanggil `posthog`/`gtag` di modul top-level → error saat SSR.
- Mengirim URL berisi token (mis. tautan reset password) sebagai properti → token bocor ke pihak ketiga. Saring query string sensitif.

## Pengujian

- **Lingkungan:** happy-dom
- **Wajib diuji:** tidak ada pemuatan sebelum persetujuan, hanya event katalog yang terkirim, properti PII tersaring, `reset()` saat logout, no-op tanpa key.
- **Dilarang di test:** jaringan ke GA/PostHog. Mock `window.gtag` dan `posthog-js`.

## Rujukan

- `packages/observability/CLAUDE.md` — analitik dan error sisi server.
- `apps/web/CLAUDE.md` — pemakaian GA di situs marketing.
