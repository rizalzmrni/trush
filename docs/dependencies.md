# Manajemen Dependensi (bun catalog & catalogs) — trush

Di monorepo, satu library dengan versi berbeda di beberapa paket menyebabkan bug tipe dan duplikasi bundle. Catalog membuat setiap versi didefinisikan **sekali** di `package.json` root, lalu dirujuk dari semua paket. Dependensi dipasang oleh lead (lihat `AGENTS.md`).

## Pohon keputusan

Berhenti di jawaban pertama yang cocok:

1. **Paket internal** (`@trush/*`) → `"workspace:*"`. Tidak pernah masuk catalog.
2. **Tooling khusus root** (hook, linter, orkestrasi monorepo) → `devDependencies` root dengan versi langsung, tanpa catalog.
3. **Termasuk kelompok di `catalogs`** → catalog bernama tersebut, walaupun baru dipakai satu paket, karena anggota kelompok di-upgrade bersamaan.
4. **Dipakai (atau hampir pasti akan dipakai) oleh ≥2 workspace** → `catalog` default.
5. **Hanya satu workspace dan tidak masuk kelompok** → pasang langsung di workspace itu dengan versi konkret. Pindahkan ke `catalog` default saat workspace kedua membutuhkannya.

Sebutkan hasil keputusan (lokasi + alasan satu kalimat) di baris "Dependensi" laporan akhir dan di deskripsi PR.

## Pembagian awal

**Root `devDependencies` (tanpa catalog):** `turbo`, `ultracite`, `oxlint`, `oxfmt`, `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`, `@commitlint/types`.

**Langsung di satu workspace (contoh):** `uuid` (`packages/db`), `aws4fetch` (`packages/storage`), `libphonenumber-js` (`packages/phone`).

**`catalog` (default):**

| Paket | Jenis | Catatan |
| --- | --- | --- |
| `typescript` | dev |  |
| `zod` | runtime |  |
| `@t3-oss/env-core` | runtime |  |
| `@types/node` | dev | **Hanya** untuk paket tooling Node (mis. `drizzle.config.ts`, skrip). Jangan masuk tsconfig kode Worker. |
| `@types/bun` | dev | **Hanya** untuk skrip yang benar-benar dijalankan dengan Bun. Jangan masuk tsconfig kode Worker atau browser. |

> Alasan: kode berjalan di workerd. Bila tipe Bun/Node ikut ke paket Worker, global seperti `Bun` atau `Buffer` lolos type-check padahal tidak tersedia di runtime. Tipe Worker dihasilkan dengan `wrangler types`.

**`catalogs`:**

| Nama | Isi | Alasan |
| --- | --- | --- |
| `react` | `react`, `react-dom`, `@types/react`, `@types/react-dom`, `react-router`, `@react-router/dev` | Versi React, tipenya, dan React Router harus cocok |
| `ui` | `tailwindcss`, `@tailwindcss/vite`, `shadcn`, `next-themes`, dan semua dependensi komponen shadcn (`@base-ui/react`, `cn`, `class-variance-authority`, `@tabler/icons-react`, `tw-animate-css`, `cmdk`, `recharts`, dll.) | Satu sistem desain |
| `tanstack` | `@tanstack/react-query`, `@tanstack/react-table`, `@tanstack/react-form` + devtools | Satu ekosistem |
| `api` | `hono`, `@hono/zod-openapi`, `@scalar/hono-api-reference`, `wrangler`, `@cloudflare/vite-plugin` | Runtime & tooling Workers + Hono |
| `db` | `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `@electric-sql/pglite` (test) | `drizzle-orm` & `drizzle-kit` wajib cocok |
| `services` | `better-auth`, `@polar-sh/better-auth`, `@polar-sh/sdk`, `resend`, `posthog-js`, `@react-email/*`, `react-email` | Integrasi layanan pihak ketiga |
| `logtape` | `@logtape/logtape`, `@logtape/redaction` | Inti & paket LogTape wajib satu versi |
| `test` | `vitest`, `@vitest/ui`, `@cloudflare/vitest-plugin`, `@msw/cloudflare`, `@playwright/test`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `happy-dom` | `vitest` harus masuk peer `@cloudflare/vitest-plugin` |
| `storybook` | `storybook` dan paket `@storybook/*` yang dipakai | Semua paket Storybook wajib berversi sama |

Paket baru yang jelas termasuk sebuah kelompok langsung masuk catalog itu. Catalog bernama **baru** harus diusulkan dulu ke user dan hanya layak bila berisi ≥2 paket yang harus di-upgrade bersamaan.

## Contoh struktur

`package.json` root:

```json
{
  "name": "trush",
  "private": true,
  "workspaces": {
    "packages": ["apps/*", "packages/*"],
    "catalog": {
      "typescript": "<versi>",
      "zod": "<versi>",
      "@t3-oss/env-core": "<versi>"
    },
    "catalogs": {
      "react": {
        "react": "<versi>",
        "react-dom": "<versi>",
        "react-router": "<versi>"
      },
      "db": { "drizzle-orm": "<versi>", "drizzle-kit": "<versi>" }
    }
  },
  "devDependencies": {
    "turbo": "<versi>",
    "husky": "<versi>"
  }
}
```

`packages/db/package.json`:

```json
{
  "dependencies": {
    "drizzle-orm": "catalog:db",
    "@neondatabase/serverless": "catalog:db",
    "zod": "catalog:"
  },
  "devDependencies": {
    "drizzle-kit": "catalog:db",
    "typescript": "catalog:"
  }
}
```

## Aturan teknis

- `catalog` dan `catalogs` didefinisikan di dalam objek `workspaces` pada `package.json` root, bukan di top-level.
- Satu paket hanya di **satu** catalog.
- Pasang dari folder workspace tujuan:
  - `bun add <paket> --catalog` → catalog default.
  - `bun add <paket> --catalog=<nama>` → catalog bernama.
  - Tambah `-d` untuk `devDependencies`. Bila entri sudah ada, bun memakai versi yang ada; jangan menulis versi eksplisit kecuali sengaja upgrade. Cek perilaku flag ini di dokumentasi bun versi terpasang.
- `dependencies`: dibutuhkan saat runtime (`zod`, `hono`, `drizzle-orm`, `react`). `devDependencies`: build, tipe, test, CLI (`typescript`, `@types/*`, `drizzle-kit`, `wrangler`, `tailwindcss`).
- `shadcn add` memasang dependensi komponen dengan versi langsung di `packages/design-system/package.json`; pindahkan ke catalog `ui` setelahnya. `recharts` dipin persis mengikuti versi di registry shadcn, karena komponen `chart` ditulis untuk versi itu.
- Catalog `storybook`: semua paket dipin persis ke satu versi yang sama, karena addon mewajibkan peer `storybook` yang cocok.
- `react-email` dan `@react-email/ui` (dipakai `apps/email`) dipin persis ke versi yang sama, karena CLI mewajibkan versi UI preview sama dengan versi CLI. `@react-email/render` disamakan dengan versi yang dipakai `@react-email/components`, agar `packages/email` hanya memuat satu salinan.
- Rentang caret (`^x.y.z`) secara default; versi persis hanya bila diwajibkan dokumentasi library, dengan alasan di commit.
- **Versi:** saat instalasi awal pakai versi stabil terbaru. Setelah itu ikuti catalog; jangan upgrade di tengah tugas lain.
- **Upgrade:** ubah versi di catalog root → `bun install` → `check-types`, `check`, `test` di **seluruh** monorepo. Pakai `bun outdated`; satu kelompok catalog per commit (`build(deps): upgrade db catalog`).
- Jangan edit `bun.lock` manual; commit bersama perubahan `package.json`.
- Hapus entri catalog yang tidak lagi dirujuk paket mana pun.
- Scope paket internal: `@trush/*`, konsisten di `package.json`, impor, dan `tsconfig`.
