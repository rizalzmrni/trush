/** Host yang bukan domain resmi: localhost, 127.0.0.1, dan `*.workers.dev`. */
const NON_OFFICIAL_HOST =
  /(?:^localhost|^127\.0\.0\.1|\.workers\.dev)(?::\d+)?$/u;

/**
 * `true` bila `host` (nilai `URL.host`, boleh dengan port) adalah domain resmi
 * trush. Dipakai untuk HSTS: hanya production di domain resmi
 * (`docs/hono-api.md`), tidak di localhost atau `*.workers.dev`.
 */
export const isOfficialHost = (host: string): boolean =>
  !NON_OFFICIAL_HOST.test(host);
