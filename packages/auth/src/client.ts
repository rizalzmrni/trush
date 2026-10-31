import {
  adminClient,
  lastLoginMethodClient,
  multiSessionClient,
  organizationClient,
  phoneNumberClient,
  twoFactorClient,
  usernameClient,
} from "better-auth/client/plugins";

/** Header token Turnstile yang dibaca plugin `captcha` di server. */
export const CAPTCHA_HEADER = "x-captcha-response";

/**
 * Header kanal OTP `phoneNumber`: `sms` untuk "kirim ulang via SMS"; tanpa
 * header = WhatsApp. Sama dengan `OTP_CHANNEL_HEADER` server.
 */
export const OTP_CHANNEL_HEADER = "x-otp-channel";

export interface AuthClientPluginOptions {
  /** Dipanggil saat login butuh verifikasi 2FA (arahkan ke halaman 2FA). */
  onTwoFactorRedirect?: () => void | Promise<void>;
}

/**
 * Client plugin pasangan plugin server (`openAPI`, `captcha`, dan
 * `haveIBeenPwned` tidak punya sisi klien). Di app:
 * `createAuthClient({ baseURL, plugins: createAuthClientPlugins() })` dari
 * `better-auth/react`.
 */
export const createAuthClientPlugins = ({
  onTwoFactorRedirect,
}: AuthClientPluginOptions = {}) => [
  organizationClient(),
  adminClient(),
  twoFactorClient({ onTwoFactorRedirect }),
  usernameClient(),
  lastLoginMethodClient(),
  multiSessionClient(),
  phoneNumberClient(),
];
