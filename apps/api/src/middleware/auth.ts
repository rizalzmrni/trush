import { createAuth } from "@trush/auth";
import { createDb } from "@trush/db";
import { EmailError } from "@trush/email";
import { getLogger } from "@trush/observability/logger";
import { PhoneError } from "@trush/phone";
import { createMiddleware } from "hono/factory";

import type { AppContext } from "../context";

/** Logger driver `log` `@trush/phone` (development): satu-satunya tempat OTP di-log. */
const phoneLogger = getLogger(["trush", "phone"]);

/**
 * Kegagalan OTP reset password di latar (B7b): hanya kode error, tanpa nomor
 * atau kode OTP. Pengguna tidak diberi tahu (respons sudah terkirim).
 */
const logPasswordResetOtpError = (error: unknown): void => {
  phoneLogger.error("OTP reset password gagal dikirim: {code}.", {
    code: error instanceof PhoneError ? error.code : "UNKNOWN",
    providerCode: error instanceof PhoneError ? error.providerCode : undefined,
  });
};

/** Logger driver `log` `@trush/email` (development): satu-satunya tempat isi email di-log. */
const emailLogger = getLogger(["trush", "email"]);

/**
 * Kegagalan email auth di latar (kode verifikasi, tautan reset): hanya kode
 * error, tanpa alamat, kode, atau tautan. Respons sudah terkirim.
 */
const logEmailDeliveryError = (error: unknown): void => {
  emailLogger.error("Email auth gagal dikirim: {code}.", {
    code: error instanceof EmailError ? error.code : "UNKNOWN",
    providerCode: error instanceof EmailError ? error.providerCode : undefined,
  });
};

/**
 * Membuat klien DB dan instance better-auth per request (tidak ada klien
 * global) untuk route di bawah `/api/*`. `waitUntil` dipakai OTP reset
 * password telepon (B7b) dan semua email auth; OTP tambah nomor dan tugas
 * better-auth lain tetap ditunggu sebelum respons (lihat `createAuth`).
 */
export const authContext = createMiddleware<AppContext>(async (c, next) => {
  const { env } = c.var;
  const db = createDb(env);
  c.set("db", db);
  c.set(
    "auth",
    createAuth({
      db,
      emailLogger,
      env,
      onEmailDeliveryError: logEmailDeliveryError,
      onPasswordResetOtpError: logPasswordResetOtpError,
      phoneLogger,
      waitUntil: (promise) => {
        c.executionCtx.waitUntil(promise);
      },
    })
  );
  return await next();
});
