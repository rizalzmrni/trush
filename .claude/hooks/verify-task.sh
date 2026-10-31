#!/usr/bin/env bash
# Hook TaskCompleted: menolak penandaan "selesai" bila Definisi Selesai belum
# terpenuhi. Exit 2 = task ditolak; stderr dikirim ke agent sebagai alasan.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Lewati sampai monorepo di-bootstrap (task L0).
[ -f turbo.json ] || exit 0

# --affected butuh repo git; tanpa git, periksa semua paket.
scope="--affected"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || scope=""

# `check` (Ultracite) adalah script root untuk seluruh repo; `check-types` dan
# `test` berjalan per paket lewat turbo.
if ! out=$( { bun run check && bunx turbo run check-types test $scope --output-logs=errors-only; } 2>&1 ); then
  {
    echo "Definisi Selesai belum terpenuhi: check-types/check/test gagal."
    echo "Perbaiki di wilayahmu, atau kirim pesan ke pemilik paket terkait."
    echo "--- 40 baris terakhir ---"
    echo "$out" | tail -n 40
  } >&2
  exit 2
fi
exit 0
