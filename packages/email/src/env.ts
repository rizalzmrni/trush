import type { ApiEnv } from "@trush/env/api";

/** Bagian env api yang dibaca `@trush/email`; divalidasi `createApiEnv`. */
export type EmailEnv = Pick<
  ApiEnv,
  | "APP_ENV"
  | "EMAIL_ALLOWLIST"
  | "EMAIL_DRIVER"
  | "EMAIL_FROM"
  | "RESEND_API_KEY"
>;
