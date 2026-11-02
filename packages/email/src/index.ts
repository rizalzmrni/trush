export { maskEmail, normalizeEmail } from "./address";
export { createEmailOutbox, defaultEmailOutbox } from "./drivers/local";
export type {
  EmailLogger,
  EmailOutbox,
  EmailOutboxEntry,
} from "./drivers/local";
export type { ResendClient } from "./drivers/resend";
export type { EmailMessage } from "./drivers/types";
export type { EmailEnv } from "./env";
export { EmailError } from "./errors";
export type { EmailErrorCode } from "./errors";
export {
  formatChangedAt,
  sendPasswordReset,
  sendPhoneNumberChanged,
  sendVerificationOtp,
} from "./send";
export type {
  SendPasswordResetInput,
  SendPhoneNumberChangedInput,
  SendVerificationOtpInput,
} from "./send";
export { createEmailSender } from "./sender";
export type { CreateEmailSenderOptions, EmailSender } from "./sender";
export { theme } from "./theme";
export { PasswordResetEmail } from "./templates/password-reset";
export type { PasswordResetEmailProps } from "./templates/password-reset";
export { PhoneNumberChangedEmail } from "./templates/phone-number-changed";
export type { PhoneNumberChangedEmailProps } from "./templates/phone-number-changed";
export { VerificationOtpEmail } from "./templates/verification-otp";
export type { VerificationOtpEmailProps } from "./templates/verification-otp";
