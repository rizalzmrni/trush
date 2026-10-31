# packages/db — Skema & klien database (Neon + Drizzle)

Sumber kebenaran skema Drizzle, factory klien Neon Postgres, generator ID, migrasi, dan seed untuk trush.

## Batas & kepemilikan

- **Isi:** skema (`src/schema`), factory klien, `newId()` (`src/id.ts`), migrasi `drizzle-kit`, seed, entry `@trush/db/testing` (`createTestDb()` PGlite).
- **Dipakai oleh:** `apps/api` (lewat service) dan `@trush/auth` (adapter + ID).
- **Tidak boleh:** logika bisnis/HTTP; diimpor oleh app frontend.
- **Pemilik (tim agent):** `backend-engineer`
- **Risiko perubahan:** Berisiko — migrasi menyentuh data produksi.

## Aturan wajib

- Driver per jalur, tidak dicampur:
  - Query di Workers: `drizzle-orm/neon-http` + `neon()` dari `@neondatabase/serverless`.
  - Transaksi interaktif di Workers: `drizzle-orm/neon-serverless` (`Pool`).
  - Migrasi dan seed: `drizzle-kit` dengan koneksi direct `DATABASE_URL_UNPOOLED`.
- Semua ID berupa UUIDv7 dari `newId()` (fungsi `v7` paket `uuid`). Tabel aplikasi: `uuid("id").primaryKey().$defaultFn(newId)`. Tabel auth bertipe `text` (hasil CLI); FK ke tabel auth juga `text`.
- Urutan kolom di skema = urutan kolom di tabel. `sort-keys` sengaja dimatikan untuk `src/schema/**`; jangan urutkan kolom secara alfabet.
- Klien dibuat per request lewat `createDb(env)`; tidak ada klien global.
- Skema berubah hanya lewat `drizzle-kit generate` + migrasi; `drizzle-kit push` dilarang. `src/schema/auth.ts` hanya dari CLI better-auth.

## Jebakan

- `crypto.randomUUID()` → UUIDv4, bukan v7. Pakai `newId()`.
- `db.transaction()` di `neon-http` → tidak didukung. Pakai `db.batch([...])` atau `Pool` (buat per request, tutup dengan `ctx.waitUntil(pool.end())`).
- Migrasi lewat host `-pooler` → DDL bisa gagal di PgBouncer. Pakai `DATABASE_URL_UNPOOLED`.
- Mengedit migrasi yang sudah diterapkan → drift. Buat migrasi baru.

## Prosedur

### Menambah/mengubah tabel

1. Ubah `src/schema/<domain>.ts`, ekspor dari `src/schema/index.ts`.
2. `bun run db:generate`, lalu tinjau SQL yang dihasilkan.
3. `bun run db:migrate` ke branch Neon dev dan verifikasi.
4. Perbarui seed bila relevan; kabari lead bila skema `core` ikut berubah.

### Menjalankan migrasi lokal

- Salin `.dev.vars.example` ke `packages/db/.dev.vars`, isi `DATABASE_URL_UNPOOLED` (direct, branch Neon dev). `drizzle.config.ts` memuatnya bila ada; var dari shell/CI menang.
- `bunx turbo run db:migrate --filter=@trush/db`. `db:generate` tidak butuh URL.
- Setelah `db:generate`, jalankan `bun run fix` (JSON di `drizzle/meta` ikut diformat Oxfmt).
- Ekspor tabel dari `src/schema/index.ts` dengan nama; `export *` ditolak `no-barrel-file`.

## Pengujian

- **Lingkungan:** Node + PGlite in-memory (`drizzle-orm/pglite`), migrasi diterapkan di setup.
- **Wajib diuji:** `newId()` menghasilkan UUIDv7 terurut waktu; query helper kritis dan constraint.
- **Dilarang di test:** jaringan ke Neon dan database produksi.

## Rujukan

- `packages/env/CLAUDE.md` — `DATABASE_URL`, `DATABASE_URL_UNPOOLED`.
- `packages/auth/CLAUDE.md` — skema tabel auth.
