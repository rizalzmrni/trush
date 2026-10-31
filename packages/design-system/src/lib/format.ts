// Satu-satunya tempat format angka, mata uang, dan tanggal (lihat DESIGN.md).
//
// Zona waktu: tanpa `timeZone`, Intl memakai zona waktu runtime. Di browser itu
// zona waktu pengguna; di server (Workers) itu UTC. Saat SSR, teruskan zona
// waktu pengguna (mis. dari profil atau cookie) agar hasil server dan klien sama.

export const DEFAULT_LOCALE = "id-ID";
export const DEFAULT_CURRENCY = "IDR";

export type DateInput = Date | number | string;

interface LocaleOptions {
  locale?: string;
}

interface DateOptions extends LocaleOptions {
  timeZone?: string;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

// Membuat objek Intl relatif mahal; formatter dipakai ulang per locale + opsi.
const cached = <T>(
  cache: Map<string, T>,
  locale: string,
  options: object,
  create: () => T
): T => {
  const key = `${locale}|${JSON.stringify(options)}`;
  const existing = cache.get(key);
  if (existing) {
    return existing;
  }
  const created = create();
  cache.set(key, created);
  return created;
};

const numberFormat = (
  locale: string,
  options: Intl.NumberFormatOptions
): Intl.NumberFormat =>
  cached(
    numberFormats,
    locale,
    options,
    () => new Intl.NumberFormat(locale, options)
  );

const dateFormat = (
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat =>
  cached(
    dateFormats,
    locale,
    options,
    () => new Intl.DateTimeFormat(locale, options)
  );

const toDate = (value: DateInput): Date =>
  value instanceof Date ? value : new Date(value);

export const formatNumber = (
  value: number,
  {
    locale = DEFAULT_LOCALE,
    ...options
  }: LocaleOptions & Intl.NumberFormatOptions = {}
): string => numberFormat(locale, options).format(value);

/** Rupiah tanpa desimal secara default; mata uang lain mengikuti standar Intl. */
export const formatCurrency = (
  value: number,
  {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    ...options
  }: LocaleOptions & Intl.NumberFormatOptions = {}
): string => {
  // Default tanpa desimal hanya bila pemanggil tidak mengatur digit pecahan;
  // memasangnya bersama `minimumFractionDigits` pemanggil memicu RangeError.
  const callerSetsFraction =
    options.minimumFractionDigits !== undefined ||
    options.maximumFractionDigits !== undefined;
  const fractionDigits =
    currency === "IDR" && !callerSetsFraction
      ? { maximumFractionDigits: 0, minimumFractionDigits: 0 }
      : {};
  return numberFormat(locale, {
    currency,
    style: "currency",
    ...fractionDigits,
    ...options,
  }).format(value);
};

/** `value` berupa pecahan: 0.25 menjadi "25%". */
export const formatPercent = (
  value: number,
  {
    locale = DEFAULT_LOCALE,
    ...options
  }: LocaleOptions & Intl.NumberFormatOptions = {}
): string =>
  numberFormat(locale, {
    maximumFractionDigits: 1,
    style: "percent",
    ...options,
  }).format(value);

export const formatDate = (
  value: DateInput,
  {
    locale = DEFAULT_LOCALE,
    timeZone,
    ...options
  }: DateOptions & Intl.DateTimeFormatOptions = {}
): string =>
  dateFormat(locale, { dateStyle: "medium", timeZone, ...options }).format(
    toDate(value)
  );

export const formatDateTime = (
  value: DateInput,
  {
    locale = DEFAULT_LOCALE,
    timeZone,
    ...options
  }: DateOptions & Intl.DateTimeFormatOptions = {}
): string =>
  dateFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
    ...options,
  }).format(toDate(value));

export const formatTime = (
  value: DateInput,
  {
    locale = DEFAULT_LOCALE,
    timeZone,
    ...options
  }: DateOptions & Intl.DateTimeFormatOptions = {}
): string =>
  dateFormat(locale, { timeStyle: "short", timeZone, ...options }).format(
    toDate(value)
  );

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", YEAR],
  ["month", MONTH],
  ["week", WEEK],
  ["day", DAY],
  ["hour", HOUR],
  ["minute", MINUTE],
];

/** Mis. "3 hari yang lalu" atau "dalam 2 jam", relatif terhadap `now`. */
export const formatRelativeTime = (
  value: DateInput,
  {
    locale = DEFAULT_LOCALE,
    now = new Date(),
  }: LocaleOptions & { now?: DateInput } = {}
): string => {
  const formatter = cached(
    relativeFormats,
    locale,
    {},
    () => new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  );
  const diff = toDate(value).getTime() - toDate(now).getTime();
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= size) {
      return formatter.format(Math.round(diff / size), unit);
    }
  }
  return formatter.format(Math.round(diff / SECOND), "second");
};
