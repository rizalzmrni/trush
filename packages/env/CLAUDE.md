# packages/env — Skema environment (t3-env + Zod)

Satu tempat mendefinisikan dan memvalidasi env trush dengan `@t3-oss/env-core`

- Zod; skema terpisah untuk `web`, `app`, `api`.

## Batas & kepemilikan

- **Isi:** factory `createWebEnv`, `createAppEnv`, `createApiEnv`, `createDbToolingEnv` (tooling `@trush/db`: `DATABASE_URL_UNPOOLED`, host `-pooler` ditolak), skema server/client (termasuk `databaseUrlSchema` untuk `DATABASE_URL` app, `phoneServerSchema` + `assertPhoneEnv` di `src/phone.ts` untuk var telepon api), tipe hasil.
- **Dipakai oleh:** semua app dan paket yang butuh env.
- **Tidak boleh:** nilai rahasia (hanya skema), I/O, membaca env saat impor.
- **Pemilik (tim agent):** `backend-engineer`
- **Risiko perubahan:** Menengah — skema salah menjatuhkan semua app. Var klien `web`/`app` dipakai frontend; kabari `frontend-engineer`.

## Aturan wajib

- Var klien wajib berawalan `VITE_` (`clientPrefix: "VITE_"`); secret hanya di blok `server`. Alasan: semua var klien masuk bundel publik.
- Gagal keras bila var wajib hilang; tanpa default diam-diam untuk secret. Aktifkan `emptyStringAsUndefined: true`.
- `APP_ENV` (`development | staging | production`) wajib di ketiga skema server dan menjadi satu-satunya penanda lingkungan. Kombinasi berbahaya ditolak saat production (lihat `docs/environments.md`); `E2E=true` hanya sah di development.
- Skema klien `web`/`app` memuat `VITE_APP_ENV`; factory server menolak bila nilainya berbeda dari `APP_ENV`.
- Factory menerima `runtimeEnv` dari pemanggil: `c.env` (api), `getCloudflare(context).env` (loader), `import.meta.env` (klien).

## Jebakan

- `createEnv` di scope modul dengan `process.env` → kosong di Workers. Ekspor factory.
- Secret di blok `client` atau berawalan `VITE_` → bocor ke browser.

## Prosedur

### Menambah env var

1. Tambahkan ke skema `server` atau `client` di factory terkait.
2. Tambahkan nama + contoh nilai palsu ke `.dev.vars.example` app terkait.
3. Var non-rahasia: `vars` di `wrangler.jsonc`. Secret produksi diset manusia lewat `wrangler secret put`.
4. Jalankan `bunx wrangler types` agar tipe `Env` ikut diperbarui.
5. Kabari lead bila var dipakai lintas-wilayah.

## Pengujian

- **Lingkungan:** Node
- **Wajib diuji:** parse valid, tolak var hilang/salah tipe, secret tidak muncul di objek klien.
- **Dilarang di test:** membaca env OS. Suntik objek env uji.
