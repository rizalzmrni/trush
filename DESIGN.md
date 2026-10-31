# DESIGN.md — Aturan Tampilan & Token UI

> Dokumen ini adalah sumber kebenaran tampilan. **Baca ini sebelum mengerjakan tugas UI apa pun.** Daftar periksa di bagian akhir termasuk dalam "Definisi Selesai" untuk tugas UI (lihat `CLAUDE.md`). Jika permintaan di chat bertentangan dengan dokumen ini, ikuti permintaan developer, tetapi sebutkan konsekuensinya pada konsistensi desain.

## Prinsip

- **Token dulu, bukan nilai mentah.** Selalu pakai token semantik (`bg-background`, `text-foreground`, `border-border`, `bg-primary`, dll.), jangan pernah menulis warna hex/oklch atau kelas warna Tailwind mentah (`bg-zinc-900`, `text-white`) di komponen. Alasan: dark mode, konsistensi, dan pergantian tema bergantung pada token.
- **Satu file CSS kanonik.** Seluruh token didefinisikan sekali di `packages/design-system/src/styles/globals.css` (lihat "CSS Kanonik"). App hanya meng-import file ini; jangan mendefinisikan ulang token di tempat lain.
- **`packages/design-system` adalah sumber utama semua desain UI**: token, `globals.css`, komponen shadcn/ui, util, dan helper tema. Komponen/warna baru ditambahkan di sini, bukan tersebar di app.
- **Mobile-first & responsif.** Rancang untuk layar kecil dulu, lalu naik ke `md`/`lg`.
- **Aksesibel.** Kontras cukup, target sentuh memadai, fokus terlihat (token `ring`), dan setiap kontrol punya label.

## Identitas Visual

- **Warna utama (primary):** hijau emerald/mint (`--primary`), dipakai untuk aksi utama, tautan penting, state aktif, dan aksen. Gunakan secukupnya sebagai sorotan, bukan untuk mewarnai area luas.
- **Netral:** latar dan permukaan memakai skala abu-abu netral (`background`, `card`, `muted`, `accent`) agar primary menonjol.
- **Tipografi:** `Outfit` (geometric sans) untuk seluruh teks UI; `--font-mono` untuk angka/kode bila perlu. Letter-spacing dasar `--tracking-normal` (0.025em) sudah diterapkan di `body`.
- **Sudut:** radius dasar `--radius` = 0.5rem, dengan turunan `sm/md/lg/xl`.
- **Bayangan:** gunakan skala `shadow-xs … shadow-2xl` dari token, jangan bikin bayangan ad-hoc.

## Peta Token Warna (kapan memakai apa)

| Token | Pemakaian |
| --- | --- |
| `background` / `foreground` | Latar halaman & teks utama |
| `card` / `card-foreground` | Permukaan kartu, panel, kontainer konten |
| `popover` / `popover-foreground` | Dropdown, popover, tooltip |
| `primary` / `primary-foreground` | Tombol utama, aksi utama, state aktif |
| `secondary` / `secondary-foreground` | Tombol/aksi sekunder |
| `muted` / `muted-foreground` | Latar redup & teks pembantu (hint, placeholder, meta) |
| `accent` / `accent-foreground` | Hover/aktif halus pada item (mis. baris menu) |
| `destructive` / `destructive-foreground` | Aksi merusak & pesan error (hapus, gagal) |
| `border` | Semua garis batas |
| `input` | Latar/garis kontrol form |
| `ring` | Cincin fokus (keyboard focus) |
| `chart-1 … chart-5` | Seri warna grafik/visualisasi |
| `sidebar*` | Token khusus area sidebar (latar, teks, item aktif, border, ring) |

Aturan:

- Teks di atas sebuah permukaan **selalu** memakai pasangan `-foreground`-nya (mis. teks di `bg-card` memakai `text-card-foreground`), agar kontras terjaga di terang maupun gelap.
- **Semantik status:** sukses/positif memakai `primary` (hijau); error/negatif memakai `destructive`. Jangan memakai warna lain untuk dua makna ini.
- Warna grafik memakai `chart-1..5` secara berurutan; jangan memakai warna acak.

## Dark Mode

- Mekanisme: berbasis **class** `.dark` (varian `@custom-variant dark (&:is(.dark *))`). Token di blok `.dark` menimpa nilai `:root`.
- Tema dikelola **next-themes** lewat `ThemeProvider` di `packages/design-system` (dipasang oleh `DesignSystemProvider`): class `.dark` di `<html>`, pilihan disimpan di localStorage, default `system`, pintasan tombol `d`. Skrip anti-kedip disisipkan next-themes saat SSR, sehingga `<html>` di root layout app wajib memakai `suppressHydrationWarning`. Toggle memakai `useTheme()` dari `next-themes`.
- Semua komponen wajib terlihat benar di terang **dan** gelap. Karena token sudah menangani keduanya, cukup pakai token — jangan menulis `dark:` dengan warna mentah.

## Komponen

- Komponen shadcn/ui ditambahkan lewat CLI (`bunx shadcn@latest add <komponen>`), jangan disalin manual. Style `base-nova` (primitif Base UI, `@base-ui/react`). Komponen mendarat di `packages/design-system/src/components/ui` dan otomatis memakai token di atas. Folder itu dikecualikan dari Oxlint/Oxfmt agar tetap sama dengan output CLI.
- `shadcn init`/`apply` tidak bisa dijalankan di `packages/design-system` (paket library, tanpa framework yang dikenali CLI); `components.json` ditulis manual (`packages/design-system/components.json`) dan `shadcn add` berjalan normal.
- `shadcn add` dijalankan dengan cwd `packages/design-system`. Alias `@trush/design-system/*` di `components.json` wajib bisa di-resolve: `exports` di `package.json` paket dan `paths` di `tsconfig.json`-nya menunjuk ke `src/*`.
- Setelah `shadcn add`, periksa diff `globals.css`: CLI dapat menambahkan variabel CSS dari registry. Token baru boleh ditambahkan (lalu catat di dokumen ini); perubahan nilai token yang sudah ada dikembalikan.
- Util `cn()` dari paket `cn` (milik shadcn, pengganti clsx + tailwind-merge); komponen hasil CLI mengimpornya langsung.
- **Ikon:** `@tabler/icons-react` (`iconLibrary: "tabler"`). Ukuran konsisten (mis. `size-4` dalam tombol), warnai dengan `currentColor` agar ikut token teks.
- **Toast/notifikasi:** Toast Base UI (`components/ui/toast`); `<Toaster />` sudah dipasang oleh `DesignSystemProvider`.
- **Tabel:** tampilan tabel (header/baris/zebra dengan token `border`/`muted`) di `packages/design-system`; integrasi `useReactTable` TanStack di `packages/data`.
- **Form:** field presentasional (label, kontrol, deskripsi, error dengan `text-destructive` + `aria-invalid`) di `packages/design-system`; `createFormHook` TanStack Form yang mendaftarkan field itu di `packages/data`. Validasi Zod. Bungkus field dengan `Form` (`components/form/form`) dan pasang atribut validasi browser (`required`, `minLength`, `type="email"`, dll.) di field agar kesalahan dasar tertangkap sebelum JavaScript validasi berjalan. Pilihan: `select` (≤10 opsi), `combobox` (daftar panjang, bisa dicari), `radio-group` (2–5 opsi yang perlu terlihat semua).
- **Komponen reusable** (presentasional: data lewat props, tanpa fetch/sesi) di `src/components/{layout,navigation,form,feedback}/`. Menu didefinisikan sekali per app sebagai `NavItem[]` (`lib/navigation`) dan dipakai header, nav mobile, footer, serta sidebar. Komponen yang membaca sesi/API tetap di app. Halaman terproteksi `apps/app` memakai `AppShell`; setiap item sidebar level atas wajib punya ikon agar tetap terbaca saat sidebar dilipat.

## State Wajib per Komponen Data

Setiap komponen yang memuat data menampilkan empat state:

1. **Loading** — skeleton/placeholder memakai `bg-muted`, bukan spinner kosong bila memungkinkan.
2. **Error** — pesan ringkas + aksi coba lagi; warna `destructive`.
3. **Empty** — keadaan kosong yang menjelaskan apa yang biasanya ada + aksi berikutnya.
4. **Success** — konten sebenarnya.

Pakai komponen `components/feedback/`: `LoadingSkeleton` (pilih varian yang mirip konten), `ErrorState`, `EmptyState`. Aksi merusak/tak bisa dibatalkan selalu lewat `ConfirmDialog` dengan `destructive` dan deskripsi akibatnya.

## Format Angka, Tanggal, Mata Uang

- Gunakan **satu helper formatter terpusat** di `@trush/design-system` (`src/lib/format.ts`); jangan memformat inline di komponen atau membuat formatter kedua di app.
- Default locale `id-ID` (dapat diubah developer). Tampilkan tanggal/waktu dalam zona waktu pengguna.

## Layout & Spacing

- Skala spacing memakai kelipatan `--spacing` (0.25rem) via utilitas Tailwind (`p-4`, `gap-6`, dst.). Hindari margin/padding bernilai piksel acak.
- Lebar konten dibatasi dengan kontainer yang wajar; hindari baris teks terlalu panjang.
- Konsisten: jarak antar-section, padding kartu, dan tinggi kontrol seragam di seluruh app.

## Yang Dilarang

- Menulis warna hex/oklch atau kelas warna Tailwind mentah di komponen.
- Mendefinisikan ulang token atau menambah warna di luar `globals.css` tanpa update dokumen ini.
- Menyalin komponen shadcn manual alih-alih lewat CLI.
- Bayangan, radius, atau font ad-hoc yang tidak memakai token.
- Menyandikan makna hanya lewat warna (selalu sertakan teks/ikon pendamping).

**Pengecualian tercatat:**

- QR code (mis. aktivasi 2FA, `apps/app/src/features/security/qr-code.tsx`) adalah gambar SVG hitam (`#000`) di atas putih (`#fff`) di kedua tema. Pemindai butuh modul gelap di atas latar terang; QR terbalik di mode gelap tidak terbaca oleh semua aplikasi authenticator.
- Email (`packages/email/src/theme.ts`) memakai hex, karena klien email tidak mendukung CSS variable maupun oklch. Nilai di bawah adalah konversi token mode terang; email tidak memakai mode gelap. Bila token di `globals.css` berubah, perbarui tabel ini dan `theme.ts` bersamaan.

  | Token                    | Hex       |
  | ------------------------ | --------- |
  | `background` / `card`    | `#fcfcfc` |
  | `foreground`             | `#171717` |
  | `primary`                | `#72e3ad` |
  | `primary-foreground`     | `#1e2723` |
  | `muted`                  | `#ededed` |
  | `muted-foreground`       | `#202020` |
  | `border`                 | `#dfdfdf` |
  | `destructive`            | `#ca3214` |
  | `destructive-foreground` | `#fffcfc` |

---

## CSS Kanonik

File berikut adalah isi kanonik `packages/design-system/src/styles/globals.css`. Ini satu-satunya tempat token didefinisikan. Jangan mengubah nilai token tanpa memperbarui dokumen ini.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

/* Deteksi otomatis Tailwind hanya memindai folder app yang mengimpor file ini;
   komponen di paket ini perlu didaftarkan agar kelasnya ikut ter-generate. */
@source "../";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.9911 0 0);
  --foreground: oklch(0.2046 0 0);
  --card: oklch(0.9911 0 0);
  --card-foreground: oklch(0.2046 0 0);
  --popover: oklch(0.9911 0 0);
  --popover-foreground: oklch(0.4386 0 0);
  --primary: oklch(0.8348 0.1302 160.908);
  --primary-foreground: oklch(0.2626 0.0147 166.4589);
  --secondary: oklch(0.994 0 0);
  --secondary-foreground: oklch(0.2046 0 0);
  --muted: oklch(0.9461 0 0);
  --muted-foreground: oklch(0.2435 0 0);
  --accent: oklch(0.9461 0 0);
  --accent-foreground: oklch(0.2435 0 0);
  --destructive: oklch(0.5523 0.1927 32.7272);
  --destructive-foreground: oklch(0.9934 0.0032 17.2118);
  --border: oklch(0.9037 0 0);
  --input: oklch(0.9731 0 0);
  --ring: oklch(0.8348 0.1302 160.908);
  --chart-1: oklch(0.8348 0.1302 160.908);
  --chart-2: oklch(0.6231 0.188 259.8145);
  --chart-3: oklch(0.6056 0.2189 292.7172);
  --chart-4: oklch(0.7686 0.1647 70.0804);
  --chart-5: oklch(0.6959 0.1491 162.4796);
  --sidebar: oklch(0.9911 0 0);
  --sidebar-foreground: oklch(0.5452 0 0);
  --sidebar-primary: oklch(0.8348 0.1302 160.908);
  --sidebar-primary-foreground: oklch(0.2626 0.0147 166.4589);
  --sidebar-accent: oklch(0.9461 0 0);
  --sidebar-accent-foreground: oklch(0.2435 0 0);
  --sidebar-border: oklch(0.9037 0 0);
  --sidebar-ring: oklch(0.8348 0.1302 160.908);
  --font-sans: Outfit, sans-serif;
  --font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --font-mono: monospace;
  --radius: 0.5rem;
  --shadow-x: 0px;
  --shadow-y: 1px;
  --shadow-blur: 3px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.17;
  --shadow-color: #000000;
  --shadow-2xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.09);
  --shadow-xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.09);
  --shadow-sm:
    0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 1px 2px -1px hsl(0 0% 0% / 0.17);
  --shadow:
    0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 1px 2px -1px hsl(0 0% 0% / 0.17);
  --shadow-md:
    0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 2px 4px -1px hsl(0 0% 0% / 0.17);
  --shadow-lg:
    0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 4px 6px -1px hsl(0 0% 0% / 0.17);
  --shadow-xl:
    0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 8px 10px -1px hsl(0 0% 0% / 0.17);
  --shadow-2xl: 0px 1px 3px 0px hsl(0 0% 0% / 0.43);
  --tracking-normal: 0.025em;
  --spacing: 0.25rem;
}

.dark {
  --background: oklch(0.1822 0 0);
  --foreground: oklch(0.9288 0.0126 255.5078);
  --card: oklch(0.2046 0 0);
  --card-foreground: oklch(0.9288 0.0126 255.5078);
  --popover: oklch(0.2603 0 0);
  --popover-foreground: oklch(0.7348 0 0);
  --primary: oklch(0.4365 0.1044 156.7556);
  --primary-foreground: oklch(0.9213 0.0135 167.1556);
  --secondary: oklch(0.2603 0 0);
  --secondary-foreground: oklch(0.9851 0 0);
  --muted: oklch(0.2393 0 0);
  --muted-foreground: oklch(0.7122 0 0);
  --accent: oklch(0.3132 0 0);
  --accent-foreground: oklch(0.9851 0 0);
  --destructive: oklch(0.3123 0.0852 29.7877);
  --destructive-foreground: oklch(0.9368 0.0045 34.3092);
  --border: oklch(0.2809 0 0);
  --input: oklch(0.2603 0 0);
  --ring: oklch(0.8003 0.1821 151.711);
  --chart-1: oklch(0.8003 0.1821 151.711);
  --chart-2: oklch(0.7137 0.1434 254.624);
  --chart-3: oklch(0.709 0.1592 293.5412);
  --chart-4: oklch(0.8369 0.1644 84.4286);
  --chart-5: oklch(0.7845 0.1325 181.912);
  --sidebar: oklch(0.1822 0 0);
  --sidebar-foreground: oklch(0.9288 0.0126 255.5078);
  --sidebar-primary: oklch(0.4365 0.1044 156.7556);
  --sidebar-primary-foreground: oklch(0.9213 0.0135 167.1556);
  --sidebar-accent: oklch(0.3132 0 0);
  --sidebar-accent-foreground: oklch(0.9851 0 0);
  --sidebar-border: oklch(0.2809 0 0);
  --sidebar-ring: oklch(0.8003 0.1821 151.711);
  --font-sans: Outfit, sans-serif;
  --font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --font-mono: monospace;
  --radius: 0.5rem;
  --shadow-x: 0px;
  --shadow-y: 1px;
  --shadow-blur: 3px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.17;
  --shadow-color: #000000;
  --shadow-2xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.09);
  --shadow-xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.09);
  --shadow-sm:
    0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 1px 2px -1px hsl(0 0% 0% / 0.17);
  --shadow:
    0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 1px 2px -1px hsl(0 0% 0% / 0.17);
  --shadow-md:
    0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 2px 4px -1px hsl(0 0% 0% / 0.17);
  --shadow-lg:
    0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 4px 6px -1px hsl(0 0% 0% / 0.17);
  --shadow-xl:
    0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 8px 10px -1px hsl(0 0% 0% / 0.17);
  --shadow-2xl: 0px 1px 3px 0px hsl(0 0% 0% / 0.43);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);

  --tracking-tighter: calc(var(--tracking-normal) - 0.05em);
  --tracking-tight: calc(var(--tracking-normal) - 0.025em);
  --tracking-normal: var(--tracking-normal);
  --tracking-wide: calc(var(--tracking-normal) + 0.025em);
  --tracking-wider: calc(var(--tracking-normal) + 0.05em);
  --tracking-widest: calc(var(--tracking-normal) + 0.1em);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    letter-spacing: var(--tracking-normal);
  }
}
```

> **Font Outfit:** token `--font-sans` memakai `Outfit`. Muat font-nya di root layout tiap app lewat `fontLinks` dari `@trush/design-system/lib/font` (`export const links = () => [...fontLinks]`) dan pasang `fontVariables` di `<body>`. Tanpa itu, teks jatuh ke `sans-serif` default.

---

## Daftar Periksa UI (bagian dari "Definisi Selesai" untuk tugas UI)

- [ ] Hanya memakai token semantik; tidak ada warna hex/oklch atau kelas warna Tailwind mentah di komponen.
- [ ] Teks memakai pasangan `-foreground` dari permukaannya (kontras benar).
- [ ] Terlihat benar di mode terang **dan** gelap.
- [ ] Komponen shadcn ditambahkan lewat CLI, bukan disalin manual.
- [ ] Komponen data menampilkan state loading, error, empty, dan success.
- [ ] Error/aksi merusak memakai `destructive`; sukses/positif memakai `primary`.
- [ ] Fokus keyboard terlihat (token `ring`); kontrol punya label/`aria` yang sesuai.
- [ ] Responsif mobile-first; tak ada scroll horizontal tak disengaja.
- [ ] Angka/tanggal/mata uang lewat helper formatter terpusat (locale `id-ID`).
- [ ] Radius, bayangan, dan font memakai token, bukan nilai ad-hoc.
- [ ] Makna tidak hanya disandikan lewat warna (ada teks/ikon pendamping).
