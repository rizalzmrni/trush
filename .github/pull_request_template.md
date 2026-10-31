## Ringkasan

<!-- 1–3 kalimat: apa yang berubah dan kenapa. -->

## Task

- STATUS.md: <!-- ID task, mis. B5 -->

## Perubahan per wilayah

- backend: —
- frontend: —
- test: —

## Kontrak, env, migrasi

- Kontrak `packages/core`: —
- Env baru: —
- Dependensi baru (lokasi catalog + alasan): —
- Migrasi DB: tidak / ya (nama file + cara rollback)

## Cara menguji

1. <!-- langkah yang bisa diulang reviewer -->

## Screenshot

<!-- Wajib untuk perubahan UI, tampilan terang dan gelap. Hapus bila tidak relevan. -->

## Risiko

<!-- Kecil / Menengah / Berisiko + alasan singkat. -->

## Checklist

- [ ] Judul sesuai `docs/git.md` (Conventional Commits, bahasa Inggris)
- [ ] `check-types`, `check`, `test` hijau
- [ ] Tanpa secret, `.dev.vars`, atau data pribadi
- [ ] Env baru tercatat di `@trush/env` dan `.dev.vars.example`
- [ ] Migrasi ditinjau dan punya cara rollback
- [ ] Struktur folder sesuai aturan pengelompokan
- [ ] `CLAUDE.md` paket diperbarui bila ada jebakan baru
