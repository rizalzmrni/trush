import {
  isSupportedCountry,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

import { PhoneError } from "./errors";

export interface NumberPolicy {
  /** ISO 3166-1 alpha-2; entri pertama = negara default nomor lokal (`08…`). */
  allowedCountries: readonly string[];
  /** Bila diisi, hanya nomor E.164 ini yang boleh dikirimi (staging). */
  allowlist?: readonly string[] | undefined;
}

/**
 * Normalisasi ke E.164 (`0812…` → `+62812…`). `undefined` bila bukan nomor
 * valid. Tidak memeriksa negara atau allowlist.
 */
export const toE164 = (
  input: string,
  defaultCountry: string | undefined
): string | undefined => {
  const country =
    defaultCountry !== undefined && isSupportedCountry(defaultCountry)
      ? defaultCountry
      : undefined;
  const parsed = parsePhoneNumberFromString(input.trim(), country);
  return parsed?.isValid() ? parsed.number : undefined;
};

/**
 * Nomor E.164 yang boleh dikirimi, atau melempar `PhoneError`
 * (`INVALID_NUMBER`, `UNSUPPORTED_DESTINATION`, `NOT_ALLOWLISTED`).
 */
export const resolveRecipient = (
  input: string,
  policy: NumberPolicy
): string => {
  const e164 = toE164(input, policy.allowedCountries[0]);
  const country = e164 ? parsePhoneNumberFromString(e164)?.country : undefined;
  if (!e164) {
    throw new PhoneError("INVALID_NUMBER", "Nomor telepon tidak valid.");
  }
  if (!country || !policy.allowedCountries.includes(country)) {
    throw new PhoneError(
      "UNSUPPORTED_DESTINATION",
      "Negara nomor telepon tidak didukung."
    );
  }
  if (policy.allowlist && !policy.allowlist.includes(e164)) {
    throw new PhoneError(
      "NOT_ALLOWLISTED",
      "Nomor telepon tidak ada di allowlist lingkungan ini."
    );
  }
  return e164;
};

/** `+6281234567890` → `+62812*****890` untuk log; tidak pernah nomor utuh. */
export const maskPhone = (e164: string): string => {
  const VISIBLE_START = 6;
  const VISIBLE_END = 3;
  if (e164.length <= VISIBLE_START + VISIBLE_END) {
    return "*".repeat(e164.length);
  }
  return `${e164.slice(0, VISIBLE_START)}${"*".repeat(e164.length - VISIBLE_START - VISIBLE_END)}${e164.slice(-VISIBLE_END)}`;
};
