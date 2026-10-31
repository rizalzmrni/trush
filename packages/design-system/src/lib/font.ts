// Outfit di-host sendiri (@fontsource/outfit), tanpa CDN pihak ketiga.
// Nama family "Outfit" sama dengan token `--font-sans` di globals.css.
import outfit400 from "@fontsource/outfit/400.css?url";
import outfit500 from "@fontsource/outfit/500.css?url";
import outfit600 from "@fontsource/outfit/600.css?url";
import outfit700 from "@fontsource/outfit/700.css?url";

interface FontLink {
  readonly href: string;
  readonly rel: "stylesheet";
}

/** Dipakai di root layout app: `export const links = () => [...fontLinks]`. */
export const fontLinks: readonly FontLink[] = [
  outfit400,
  outfit500,
  outfit600,
  outfit700,
].map((href) => ({ href, rel: "stylesheet" }));

/** Kelas untuk `<body>` agar teks memakai token `--font-sans`. */
export const fontVariables = "font-sans antialiased";
