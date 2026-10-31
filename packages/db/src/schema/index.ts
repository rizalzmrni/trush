// Titik ekspor seluruh skema Drizzle (dipakai drizzle-kit dan `createDb`).
// Tambahkan ekspor bernama untuk setiap tabel baru (`export *` ditolak lint
// `no-barrel-file`); tabel auth menyusul dari CLI better-auth di B6. Helper
// kolom bukan tabel, jadi diabaikan drizzle-kit.
export { primaryId, timestamps } from "./columns";
