# e2e — Test end-to-end (Playwright)

Test alur utuh lintas `apps/web`, `apps/app`, dan `apps/api` di browser nyata dengan Playwright Test. Unit, integrasi, dan komponen tetap di Vitest.

## Batas & kepemilikan

- **Isi:** `playwright.config.ts`, `tests/**/*.e2e.ts`, `tests/auth.setup.ts`, fixture dan page object (`fixtures/`), `scripts/write-dev-vars.ts` (menulis `.dev.vars.e2e` tiap app; tidak pernah menyentuh `.dev.vars`).
- **Dipakai oleh:** `.github/workflows/e2e.yml` dan developer lokal (`bun run test:e2e`).
- **Tidak boleh:** kode sumber app/paket, layanan pihak ketiga nyata, data staging/produksi, script `test` (workspace ini hanya punya `test:e2e`).
- **Pemilik (tim agent):** `qa-tester` (seluruh workspace, termasuk konfigurasi)
- **Risiko perubahan:** Kecil — tidak ikut bundel, tetapi test rapuh menghambat merge.

## Aturan wajib

- File test berakhiran `*.e2e.ts`, bukan `.spec`/`.test`, agar tidak ikut dijalankan Vitest dan tidak terkena rule lint Vitest.
- Server dinyalakan `webServer` Playwright dengan `CLOUDFLARE_ENV=e2e` (blok `env.e2e`: `APP_ENV=development`, `E2E=true`). OTP dan email dibaca lewat `GET /__e2e/outbox` (driver `memory`), tidak pernah lewat layanan nyata.
- Selector berbasis peran dan label (`getByRole`, `getByLabel`). `data-testid` hanya bila tidak ada peran yang tepat, dan diminta ke `frontend-engineer`.
- Tanpa `waitForTimeout`; pakai assertion web-first (`await expect(locator).toBeVisible()`).
- Setiap test membuat datanya sendiri (pengguna unik) dan tidak bergantung pada urutan test lain.
- Login sekali di project `setup`, disimpan di `.auth/` (di-gitignore), dipakai ulang lewat `storageState`.
- Cakupan hanya alur kritis: daftar, login + OTP, auth gate (redirect ke `/sign-in?redirectTo=`), organisasi lewat `:slug`, logout. Detail validasi tetap di unit test.

## Jebakan

- Menamai file `*.spec.ts` → ikut dijalankan Vitest dan gagal.
- Port `webServer` berbeda dari konfigurasi dev app → Playwright menunggu sampai timeout.
- Pengguna yang sama dipakai test paralel → test saling mengganggu.
- `APP_ENV`/`E2E` disetel lewat env proses Playwright → tidak sampai ke Worker. Worker hanya membaca `wrangler.jsonc` dan `.dev.vars.e2e`.
- Satu secret lupa ditulis di `.dev.vars.e2e` → nilainya kosong, karena `.dev.vars` umum diabaikan saat file khusus lingkungan ada.

## Pengujian

- **Lingkungan:** Playwright Test (Chromium; Firefox/WebKit bila dibutuhkan)
- **Wajib diuji:** alur kritis di atas.
- **Dilarang di test:** staging/produksi, layanan pihak ketiga nyata, `test.only` (ditolak `forbidOnly` di CI).

## Rujukan

- `docs/environments.md` — lingkungan development dan variabel `E2E`.
- `docs/react-router.md` — auth gate dan Service Binding.
