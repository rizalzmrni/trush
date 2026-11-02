import { formatRelativeTime } from "@trush/design-system/lib/format";

const MS_PER_SECOND = 1000;
const RETRY_AFTER_HEADERS = ["retry-after", "x-retry-after"] as const;
const DELTA_SECONDS = /^\d+$/u;

/** Detik positif dari satu header, atau `undefined` bila tidak ada/tak valid. */
const headerSeconds = (raw: string | null): number | undefined => {
  const value = raw?.trim();
  if (value === undefined || !DELTA_SECONDS.test(value)) {
    return undefined;
  }
  const seconds = Number(value);
  return seconds > 0 ? seconds : undefined;
};

/**
 * Detik tunggu dari `Retry-After` (kuota OTP `OTP_RATE_LIMITED`) atau
 * `X-Retry-After` (rate limit IP better-auth). Hanya bentuk detik. Header
 * pertama yang valid menurut urutan itu dipakai; `Retry-After` yang tidak
 * valid tidak menutupi `X-Retry-After` yang valid.
 */
export const retryAfterSeconds = (response: Response): number | undefined => {
  for (const name of RETRY_AFTER_HEADERS) {
    const seconds = headerSeconds(response.headers.get(name));
    if (seconds !== undefined) {
      return seconds;
    }
  }
  return undefined;
};

/**
 * Pesan 429 dengan waktu tunggu relatif, mis. "Terlalu banyak permintaan
 * kode. Coba lagi dalam 12 menit." Tanpa header → "Tunggu sebentar…".
 */
export const rateLimitMessage = (
  response: Response,
  subject: string,
  now: Date = new Date()
): string => {
  const seconds = retryAfterSeconds(response);
  if (seconds === undefined) {
    return `${subject} Tunggu sebentar lalu coba lagi.`;
  }
  const retryAt = new Date(now.getTime() + seconds * MS_PER_SECOND);
  return `${subject} Coba lagi ${formatRelativeTime(retryAt, { now })}.`;
};
