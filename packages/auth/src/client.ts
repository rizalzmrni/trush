import {
  adminClient,
  lastLoginMethodClient,
  multiSessionClient,
  organizationClient,
  twoFactorClient,
  usernameClient,
} from "better-auth/client/plugins";

/** Header token Turnstile yang dibaca plugin `captcha` di server. */
export const CAPTCHA_HEADER = "x-captcha-response";

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
];
