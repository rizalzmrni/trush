/**
 * Helper test resmi `@trush/auth/testing` (hanya untuk test; tidak diimpor
 * kode runtime). Sejak `requireEmailVerification: true`, pengguna hasil
 * `signUpEmail` tidak bisa login sebelum emailnya terverifikasi.
 */
import { defaultEmailOutbox } from "@trush/email";
import type { EmailEnv, EmailOutbox } from "@trush/email";

import type { Auth } from "./auth";

/**
 * Var email untuk `AuthEnv` uji: driver `memory` (tanpa Resend), tanpa
 * allowlist, dan `APP_URL` (tujuan tautan buat kata sandi B19; `createAuth`
 * tidak memeriksanya terhadap `CORS_ORIGINS`, tetapi membuka tautan itu
 * butuh origin ini di `CORS_ORIGINS` uji). Sebar ke env uji:
 * `{ ...BASE_ENV, ...TEST_EMAIL_ENV }`.
 */
export const TEST_EMAIL_ENV = {
  APP_URL: "http://localhost:5174",
  EMAIL_ALLOWLIST: undefined,
  EMAIL_DRIVER: "memory",
  EMAIL_FROM: undefined,
  RESEND_API_KEY: undefined,
} as const satisfies Omit<EmailEnv, "APP_ENV"> & { APP_URL: string };

/**
 * Tandai email pengguna terverifikasi langsung di DB (jalan pintas untuk test
 * yang tidak menguji alur verifikasi). Melempar bila pengguna tidak ada.
 */
export const markEmailVerified = async (
  auth: Auth,
  email: string
): Promise<void> => {
  const context = await auth.$context;
  const found = await context.internalAdapter.findUserByEmail(
    email.trim().toLowerCase()
  );
  if (found === null) {
    throw new Error("markEmailVerified: pengguna tidak ditemukan.");
  }
  await context.internalAdapter.updateUser(found.user.id, {
    emailVerified: true,
  });
};

export interface SignUpVerifiedInput {
  name: string;
  email: string;
  password: string;
  /** Header request (mis. token captcha `x-captcha-response`). */
  headers?: HeadersInit | undefined;
}

/**
 * Daftar lewat `auth.api.signUpEmail` lalu tandai email terverifikasi, jadi
 * pengguna bisa langsung login. Mengembalikan id pengguna.
 */
export const signUpVerified = async (
  auth: Auth,
  { email, headers, name, password }: SignUpVerifiedInput
): Promise<string> => {
  const result = await auth.api.signUpEmail({
    body: { email, name, password },
    headers: new Headers(headers),
  });
  await markEmailVerified(auth, email);
  return result.user.id;
};

/**
 * Kode verifikasi email terakhir untuk `email` dari outbox driver `memory`
 * (untuk test alur verifikasi sungguhan). `undefined` bila belum ada.
 */
export const latestEmailOtp = (
  email: string,
  outbox: EmailOutbox = defaultEmailOutbox
): string | undefined => outbox.latestFor(email)?.code ?? undefined;
