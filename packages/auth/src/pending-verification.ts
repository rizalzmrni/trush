import { sendPasswordReset } from "@trush/email";
import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";

import { PASSWORD_RESET_EXPIRES_SECONDS, runDetached } from "./email";
import type { EmailDeliveryOptions } from "./email";

/**
 * B19 (pra-pembajakan akun): penyerang bisa mendaftar memakai email korban
 * dengan kata sandinya sendiri. Bila korban lalu memverifikasi email itu,
 * akun menjadi aktif dengan kata sandi penyerang. Kepemilikan kata sandi
 * dibuktikan lewat cookie `email_pending` bertanda tangan (userId) yang
 * dipasang hanya saat sign-up sukses atau login berkata sandi benar yang
 * berakhir 403 `EMAIL_NOT_VERIFIED`. verify-email untuk akun belum
 * terverifikasi tanpa cookie sah untuk akun itu → akses tak terbukti dicabut
 * (pola `revokeUnprovenAccountAccess` better-auth) dan tautan untuk membuat
 * kata sandi dikirim ke pemilik email.
 */
const PENDING_COOKIE = "email_pending";
const PENDING_MAX_AGE_SECONDS = 3600;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const RESET_TOKEN_BYTES = 18;

const SIGN_IN_PATHS: ReadonlySet<string> = new Set([
  "/sign-in/email",
  "/sign-in/username",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const pendingCookie = (ctx: GenericEndpointContext) =>
  ctx.context.createAuthCookie(PENDING_COOKIE, {
    maxAge: PENDING_MAX_AGE_SECONDS,
  });

const setPendingCookie = async (
  ctx: GenericEndpointContext,
  userId: string
): Promise<void> => {
  const cookie = pendingCookie(ctx);
  await ctx.setSignedCookie(
    cookie.name,
    userId,
    ctx.context.secret,
    cookie.attributes
  );
};

const clearPendingCookie = (ctx: GenericEndpointContext): void => {
  const cookie = pendingCookie(ctx);
  ctx.setCookie(cookie.name, "", { ...cookie.attributes, maxAge: 0 });
};

const returnedOf = (ctx: GenericEndpointContext): unknown =>
  "returned" in ctx.context ? ctx.context.returned : undefined;

const isEmailNotVerified = (returned: unknown): boolean =>
  returned instanceof APIError &&
  isRecord(returned.body) &&
  returned.body.code === "EMAIL_NOT_VERIFIED";

/** userId dari body login (email atau username, sama normalisasinya dengan better-auth). */
const signInUserId = async (
  ctx: GenericEndpointContext
): Promise<string | undefined> => {
  const { body } = ctx;
  if (!isRecord(body)) {
    return undefined;
  }
  if (ctx.path === "/sign-in/email" && typeof body.email === "string") {
    const found = await ctx.context.internalAdapter.findUserByEmail(
      body.email.toLowerCase()
    );
    return found?.user.id;
  }
  if (typeof body.username === "string") {
    const user = await ctx.context.adapter.findOne<{ id: string }>({
      model: "user",
      where: [{ field: "username", value: body.username.toLowerCase() }],
    });
    return user?.id;
  }
  return undefined;
};

/** Hook `after` (selain verify-email): pasang cookie bukti kata sandi (sign-up sukses, login 403 belum terverifikasi). */
export const markPasswordProven = async (
  ctx: GenericEndpointContext
): Promise<void> => {
  const returned = returnedOf(ctx);
  if (ctx.path === "/sign-up/email") {
    const user =
      isRecord(returned) && isRecord(returned.user) ? returned.user : null;
    if (user !== null && typeof user.id === "string") {
      await setPendingCookie(ctx, user.id);
    }
    return;
  }
  if (SIGN_IN_PATHS.has(ctx.path) && isEmailNotVerified(returned)) {
    const userId = await signInUserId(ctx);
    if (userId !== undefined) {
      await setPendingCookie(ctx, userId);
    }
  }
};

/** Status akun sebelum verify-email, dicatat hook `before` per request. */
interface PendingVerification {
  userId: string;
  proven: boolean;
}

const pendingByRequest = new WeakMap<object, PendingVerification>();

const requestKey = (ctx: GenericEndpointContext): object | undefined =>
  ctx.request ?? ctx.headers ?? undefined;

/**
 * Hook `before` `/email-otp/verify-email`: catat apakah akun belum
 * terverifikasi dan apakah browser membawa cookie sah untuk akun itu.
 * Belum mengubah apa pun (kode belum diperiksa).
 */
export const recordPendingVerification = async (
  ctx: GenericEndpointContext,
  email: string
): Promise<void> => {
  const key = requestKey(ctx);
  if (key === undefined) {
    return;
  }
  const found = await ctx.context.internalAdapter.findUserByEmail(email);
  if (found === null || found.user.emailVerified) {
    return;
  }
  const cookieUserId = await ctx.getSignedCookie(
    pendingCookie(ctx).name,
    ctx.context.secret
  );
  pendingByRequest.set(key, {
    proven: cookieUserId === found.user.id,
    userId: found.user.id,
  });
};

const randomToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(RESET_TOKEN_BYTES));
  return btoa(String.fromCodePoint(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

export interface UnprovenAccessOptions extends EmailDeliveryOptions {
  /** `APP_URL`: tujuan tautan reset (`<APP_URL>/reset-password`). */
  appUrl: string;
}

/** Cabut kata sandi, sesi, dan nomor telepon yang belum terbukti milik pemilik email. */
const revokeUnprovenAccess = async (
  ctx: GenericEndpointContext,
  userId: string
): Promise<void> => {
  const adapter = ctx.context.internalAdapter;
  const accounts = await adapter.findAccounts(userId);
  await Promise.all(
    accounts.map(async (account) => {
      await adapter.deleteAccount(account.id);
    })
  );
  await adapter.deleteUserSessions(userId);
  await adapter.updateUser(userId, {
    phoneNumber: null,
    phoneNumberVerified: false,
  });
};

/** Tautan "buat kata sandi" = tautan reset biasa (template `password-reset`). */
const sendPasswordSetupLink = async (
  ctx: GenericEndpointContext,
  user: { id: string; email: string },
  options: UnprovenAccessOptions
): Promise<void> => {
  const token = randomToken();
  await ctx.context.internalAdapter.createVerificationValue({
    expiresAt: new Date(
      Date.now() + PASSWORD_RESET_EXPIRES_SECONDS * MS_PER_SECOND
    ),
    identifier: `reset-password:${token}`,
    value: user.id,
  });
  const callbackURL = encodeURIComponent(
    new URL("/reset-password", options.appUrl).href
  );
  const url = `${ctx.context.baseURL}/reset-password/${token}?callbackURL=${callbackURL}`;
  await runDetached(
    async () =>
      await sendPasswordReset(options.emailSender, {
        expiresInMinutes: PASSWORD_RESET_EXPIRES_SECONDS / SECONDS_PER_MINUTE,
        to: user.email,
        token,
        url,
        userId: user.id,
      }),
    options
  );
};

/**
 * Hook `after` `/email-otp/verify-email` sukses: akun yang sebelumnya
 * belum terverifikasi tanpa bukti kata sandi → cabut akses tak terbukti +
 * kirim tautan pembuatan kata sandi. Respons diberi `passwordSetupRequired`
 * (kontrak `verifyEmailOtpResponseSchema`); cookie pending dihapus.
 */
export const settleVerification =
  (options: UnprovenAccessOptions) => async (ctx: GenericEndpointContext) => {
    const returned = returnedOf(ctx);
    if (!isRecord(returned) || returned.status !== true) {
      return;
    }
    const key = requestKey(ctx);
    const pending = key === undefined ? undefined : pendingByRequest.get(key);
    clearPendingCookie(ctx);
    const passwordSetupRequired = pending !== undefined && !pending.proven;
    if (pending !== undefined && passwordSetupRequired) {
      await revokeUnprovenAccess(ctx, pending.userId);
      const user = isRecord(returned.user) ? returned.user : {};
      if (typeof user.email === "string") {
        await sendPasswordSetupLink(
          ctx,
          { email: user.email, id: pending.userId },
          options
        );
      }
    }
    return ctx.json({ ...returned, passwordSetupRequired });
  };
