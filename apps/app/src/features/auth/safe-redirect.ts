/** Tujuan bawaan setelah login / bila `redirectTo` ditolak. */
export const DEFAULT_REDIRECT = "/";

export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const SIGN_OUT_PATH = "/sign-out";
export const VERIFY_EMAIL_PATH = "/verify-email";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";

/** Nama query string tujuan setelah login. */
export const REDIRECT_PARAM = "redirectTo";

// Origin semu: hanya untuk memastikan hasil parse tetap di origin yang sama.
const INTERNAL_ORIGIN = "http://trush.internal";

/** Halaman auth tidak pernah menjadi tujuan (mencegah putaran redirect). */
const AUTH_PATHS = new Set([
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  SIGN_OUT_PATH,
  VERIFY_EMAIL_PATH,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
]);

const TRAILING_SLASHES = /\/+$/u;

/** Awalan yang dibaca browser sebagai host lain (`//host`, `/\host`). */
const EXTERNAL_PREFIX = /^\/[/\\]/u;

const parseInternal = (path: string): URL | undefined => {
  try {
    const url = new URL(path, INTERNAL_ORIGIN);
    return url.origin === INTERNAL_ORIGIN ? url : undefined;
  } catch {
    return undefined;
  }
};

// Pencocokan route React Router tidak peka huruf dan garis miring akhir.
const isAuthPath = (pathname: string): boolean =>
  AUTH_PATHS.has(pathname.replace(TRAILING_SLASHES, "").toLowerCase());

/**
 * Saring tujuan redirect agar hanya path internal app (cegah open redirect).
 * Menolak URL absolut, `//host`, `/\host`, karakter kontrol yang dibuang
 * parser URL, dot-segment yang menormalisasi menjadi `//host`, dan halaman
 * auth (termasuk varian huruf besar / garis miring akhir). Validasi dilakukan
 * pada hasil akhir, karena itulah yang dipakai sebagai `Location`.
 */
export const getSafeRedirect = (
  to: unknown,
  fallback: string = DEFAULT_REDIRECT
): string => {
  if (
    typeof to !== "string" ||
    !to.startsWith("/") ||
    EXTERNAL_PREFIX.test(to)
  ) {
    return fallback;
  }
  const url = parseInternal(to);
  if (!url || isAuthPath(url.pathname)) {
    return fallback;
  }
  const result = `${url.pathname}${url.search}${url.hash}`;
  // Hasil normalisasi (mis. `/.//host` → `//host`) bisa keluar origin bila
  // dipakai browser sebagai URL relatif; parse ulang untuk memastikan.
  if (EXTERNAL_PREFIX.test(result) || !parseInternal(result)) {
    return fallback;
  }
  return result;
};

/**
 * `path?…` dengan query tambahan dan `redirectTo` tersaring (dihilangkan bila
 * sama dengan tujuan bawaan). Query kosong → path saja.
 */
export const authPath = (
  path: string,
  redirectTo?: string,
  query: Readonly<Record<string, string | undefined>> = {}
): string => {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value) {
      params.set(name, value);
    }
  }
  const target = getSafeRedirect(redirectTo);
  if (target !== DEFAULT_REDIRECT) {
    params.set(REDIRECT_PARAM, target);
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
};

/** `/sign-in?redirectTo=…` dengan tujuan yang sudah disaring. */
export const signInPath = (redirectTo?: string): string =>
  authPath(SIGN_IN_PATH, redirectTo);

/** Tujuan redirect dari query string URL (sudah disaring). */
export const redirectFromUrl = (url: string | URL): string =>
  getSafeRedirect(new URL(url).searchParams.get(REDIRECT_PARAM));
