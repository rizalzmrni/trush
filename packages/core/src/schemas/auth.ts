import { z } from "zod";

/**
 * Batas panjang password = default better-auth (`emailAndPassword`
 * `minPasswordLength`/`maxPasswordLength`); ubah bersamaan bila `createAuth`
 * menyetelnya.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 100;

/** Input form login email (`/api/auth/sign-in/email`). */
export const signInEmailInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/** Input form daftar email (`/api/auth/sign-up/email`). */
export const signUpEmailInputSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  email: z.email(),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

export type SignInEmailInput = z.infer<typeof signInEmailInputSchema>;
export type SignUpEmailInput = z.infer<typeof signUpEmailInputSchema>;
