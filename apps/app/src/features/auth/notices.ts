/** Query string pesan sukses yang dibawa redirect antarhalaman auth. */
export const NOTICE_PARAM = "notice";

export const AUTH_NOTICES = {
  /** Email terverifikasi; pengguna login ulang (sesi tidak dibuat otomatis). */
  emailVerified: "email-verified",
  /** Kata sandi diganti; semua sesi dicabut. */
  passwordReset: "password-reset",
} as const;

export type AuthNotice = (typeof AUTH_NOTICES)[keyof typeof AUTH_NOTICES];

const NOTICE_MESSAGES: Readonly<Record<AuthNotice, string>> = {
  [AUTH_NOTICES.emailVerified]:
    "Email berhasil diverifikasi. Silakan masuk dengan kata sandimu.",
  [AUTH_NOTICES.passwordReset]:
    "Kata sandi berhasil diganti dan semua sesi lama sudah diakhiri. Silakan masuk dengan kata sandi baru.",
};

/**
 * Pesan sukses dari `?notice=` URL. Hanya nilai yang dikenal; teks tidak
 * pernah diambil dari URL (mencegah pesan palsu lewat tautan).
 */
export const noticeFromUrl = (url: string | URL): string | undefined => {
  const value = new URL(url).searchParams.get(NOTICE_PARAM);
  return Object.hasOwn(NOTICE_MESSAGES, value ?? "")
    ? NOTICE_MESSAGES[value as AuthNotice]
    : undefined;
};
