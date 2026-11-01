/**
 * Host yang bukan domain resmi: localhost, loopback (127.0.0.0/8, `[::1]`),
 * dan `*.workers.dev`, dengan atau tanpa port.
 */
const NON_OFFICIAL_HOST =
  /(?:^localhost|^127(?:\.\d{1,3}){3}|^\[::1\]|\.workers\.dev)(?::\d+)?$/u;

/**
 * `true` bila `host` (nilai `URL.host`, boleh dengan port) adalah domain resmi
 * trush. Dipakai untuk HSTS: hanya production di domain resmi
 * (`docs/hono-api.md`), tidak di localhost, loopback, atau `*.workers.dev`.
 */
export const isOfficialHost = (host: string): boolean =>
  !NON_OFFICIAL_HOST.test(host);
