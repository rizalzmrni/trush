/**
 * Token visual email. Warna = tabel hex "Pengecualian tercatat" `DESIGN.md`
 * (konversi token mode terang; klien email tidak mendukung CSS variable,
 * oklch, maupun mode gelap yang andal). Ukuran dalam px. Bila token
 * `globals.css` berubah, perbarui tabel `DESIGN.md` dan file ini bersamaan.
 */
export const theme = {
  color: {
    background: "#fcfcfc",
    border: "#dfdfdf",
    card: "#fcfcfc",
    destructive: "#ca3214",
    destructiveForeground: "#fffcfc",
    foreground: "#171717",
    muted: "#ededed",
    mutedForeground: "#202020",
    primary: "#72e3ad",
    primaryForeground: "#1e2723",
  },
  /** Font web-safe: banyak klien email mengabaikan font kustom. */
  font: {
    body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
  fontSize: {
    code: 32,
    heading: 22,
    small: 13,
    text: 15,
  },
  lineHeight: {
    heading: 30,
    text: 24,
  },
  radius: 8,
  space: {
    lg: 32,
    md: 24,
    sm: 16,
    xs: 8,
  },
  width: 560,
} as const;

export type Theme = typeof theme;
