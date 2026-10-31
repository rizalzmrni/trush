# Alur Git & Commit — trush

`main` selalu bisa di-deploy; satu branch per fitur/perbaikan. Aturan PR ada di `docs/pull-requests.md`.

## Branch

- Format `<tipe>/<deskripsi-singkat>`; bila ada task di `STATUS.md`: `<tipe>/<id-task>-<deskripsi>`, mis. `feat/b5-api-health`.
- Tipe branch = `type` commit:

  | Tipe       | Untuk apa                                        |
  | ---------- | ------------------------------------------------ |
  | `feat`     | fitur baru                                       |
  | `fix`      | perbaikan bug                                    |
  | `refactor` | merapikan kode tanpa mengubah perilaku           |
  | `perf`     | peningkatan performa                             |
  | `test`     | menambah/mengubah pengujian                      |
  | `docs`     | dokumentasi                                      |
  | `chore`    | hal teknis (config, pemeliharaan)                |
  | `build`    | sistem build / dependency yang memengaruhi build |
  | `ci`       | konfigurasi CI/CD                                |

- Deskripsi: huruf kecil, kata dipisah `-`, 2–4 kata, bahasa Inggris, tanpa spasi atau karakter khusus. ID task ditulis huruf kecil.
- **Tim berbagi satu working tree.** Lead membuat branch sebelum teammate di-spawn; satu branch berisi satu batch task paralel (mis. `feat/fase1-foundation`). `git switch` hanya saat semua teammate idle, karena berpindah branch mengganti file yang sedang disunting agent lain.
- Di dalam batch, lead membuat commit atomik per task dengan `git add <path>` dari daftar "File diubah" di laporan; tidak pernah `git add -A` atau `git add .`.

```bash
git switch main && git pull --ff-only
git switch -c feat/b5-api-health
# ... kerja & commit (hook berjalan otomatis) ...
git push -u origin feat/b5-api-health
gh pr create --fill   # lalu lengkapi sesuai template PR
```

## Commit (Conventional Commits)

```
type(scope opsional): subjek singkat

body opsional — jelaskan "kenapa", bukan "apa"

footer opsional — mis. Closes #42
```

- `type`: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`.
- `scope` opsional; bila diisi harus dari `commitlint.config.ts` (nama app/paket; `apps/email` = `email-preview`; lintas repo: `repo`, `deps`, `ci`, `docs`, `agents`).
- Subjek: bahasa Inggris, mode perintah ("add"), huruf kecil, tanpa titik akhir, maksimal 72 karakter. Contoh: `feat(auth): add password reset flow`.
- Breaking change: `!` setelah type/scope + footer `BREAKING CHANGE:`.
- Commit atomik: satu perubahan logis per commit; jangan campur fitur dan refactor.
- Membatalkan perubahan: `git revert` (pesan `Revert "..."` bawaan git), bukan type `revert`.

## Penegakan otomatis (Husky + lint-staged + commitlint)

- `pre-commit`: lint-staged (`--no-stash`, agar tidak menyimpan lalu mengembalikan file yang sedang disunting teammate) menjalankan `bunx ultracite fix` pada file yang di-stage, lalu `bunx turbo run check-types --affected` (hanya paket yang berubah, agar tetap cepat seiring monorepo membesar).
- `commit-msg`: commitlint memvalidasi Conventional Commits.
- `pre-push` dan CI: `check-types`, `check`, dan `test` penuh. CI ada di `.github/workflows/ci.yml` (setiap PR dan push ke `main`, tanpa secret) dan juga memvalidasi judul PR. Saat upgrade bun, samakan `bun-version` di workflow dengan `devEngines` di `package.json`.
- Konfigurasi: `commitlint.config.ts`, `.lintstagedrc.json`, `.husky/`.
- Hook gagal → perbaiki penyebabnya lalu commit ulang; jangan melewati hook.

## Kewenangan agent

| Siapa | Boleh | Minta izin dulu | Dilarang |
| --- | --- | --- | --- |
| teammate | `git status`, `git diff`, `git log` | — | perintah git/gh lain (diblokir hook `guard-git.ts`) |
| lead | buat branch, `git add`, commit setelah Definisi Selesai, push branch fitur, buat PR, merge `gh pr merge <n> --squash --auto --delete-branch` bila prasyarat PR bagian 0 terpenuhi | `git rebase`, hapus branch lokal, `git push --force-with-lease` | push ke `main`, `--force`, `--no-verify`, `git reset --hard`, `gh pr merge --admin`, approve PR |

## Keamanan

Jangan pernah commit secret, `.env*` (kecuali `.env.example`), atau `.dev.vars`. Pastikan pola ini ada di `.gitignore`.
