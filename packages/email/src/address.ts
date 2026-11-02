import type { EmailEnv } from "./env";
import { EmailError } from "./errors";

/** Sengaja longgar (sama dengan `@trush/env`); Resend memvalidasi ulang. */
const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u;

/** Alamat dipangkas dan huruf kecil, atau `undefined` bila tidak valid. */
export const normalizeEmail = (address: string): string | undefined => {
  const normalized = address.trim().toLowerCase();
  return ADDRESS.test(normalized) ? normalized : undefined;
};

/** `budi@example.com` → `b***@example.com` (untuk log). */
export const maskEmail = (address: string): string => {
  const at = address.lastIndexOf("@");
  if (at <= 0) {
    return "***";
  }
  return `${address.slice(0, 1)}***${address.slice(at)}`;
};

/** `true` bila allowlist kosong, alamat tercantum, atau domainnya `@domain` tercantum. */
const isAllowlisted = (
  address: string,
  allowlist: readonly string[] | undefined
): boolean => {
  if (allowlist === undefined || allowlist.length === 0) {
    return true;
  }
  const domain = address.slice(address.lastIndexOf("@"));
  return allowlist.includes(address) || allowlist.includes(domain);
};

/**
 * Alamat tujuan final (huruf kecil). Melempar `EmailError` tanpa memuat
 * alamat bila tidak valid atau di luar `EMAIL_ALLOWLIST`.
 */
export const resolveRecipient = (
  address: string,
  env: Pick<EmailEnv, "EMAIL_ALLOWLIST">
): string => {
  const to = normalizeEmail(address);
  if (to === undefined) {
    throw new EmailError("INVALID_ADDRESS", "Alamat email tidak valid.");
  }
  if (!isAllowlisted(to, env.EMAIL_ALLOWLIST)) {
    throw new EmailError(
      "NOT_ALLOWLISTED",
      "Alamat email di luar EMAIL_ALLOWLIST."
    );
  }
  return to;
};
