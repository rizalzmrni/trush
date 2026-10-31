/** Tujuan bawaan setelah login / bila `redirectTo` ditolak. */
export const DEFAULT_REDIRECT = "/";

export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const SIGN_OUT_PATH = "/sign-out";

/** Nama query string tujuan setelah login. */
export const REDIRECT_PARAM = "redirectTo";

// Origin semu: hanya untuk memastikan hasil parse tetap di origin yang sama.
const INTERNAL_ORIGIN = "http://trush.internal";

/** Halaman auth tidak pernah menjadi tujuan (mencegah putaran redirect). */
const AUTH_PATHS = new Set([SIGN_IN_PATH, SIGN_UP_PATH, SIGN_OUT_PATH]);

/**
 * Saring tujuan redirect agar hanya path internal app (cegah open redirect).
 * Menolak URL absolut, `//host`, `/\host`, karakter kontrol yang dibuang
 * parser URL, dan halaman auth; hasilnya path ternormalisasi.
 */
export const getSafeRedirect = (
  to: unknown,
  fallback: string = DEFAULT_REDIRECT
): string => {
  if (typeof to !== "string" || !to.startsWith("/") || to.startsWith("//")) {
    return fallback;
  }
  let url: URL;
  try {
    url = new URL(to, INTERNAL_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== INTERNAL_ORIGIN || AUTH_PATHS.has(url.pathname)) {
    return fallback;
  }
  return `${url.pathname}${url.search}${url.hash}`;
};

/** `/sign-in?redirectTo=…` dengan tujuan yang sudah disaring. */
export const signInPath = (redirectTo?: string): string => {
  const target = getSafeRedirect(redirectTo);
  if (target === DEFAULT_REDIRECT) {
    return SIGN_IN_PATH;
  }
  return `${SIGN_IN_PATH}?${new URLSearchParams({ [REDIRECT_PARAM]: target })}`;
};

/** Tujuan redirect dari query string URL (sudah disaring). */
export const redirectFromUrl = (url: string | URL): string =>
  getSafeRedirect(new URL(url).searchParams.get(REDIRECT_PARAM));
