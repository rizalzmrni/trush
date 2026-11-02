import { sendPhoneNumberChanged } from "@trush/email";
import { maskPhone } from "@trush/phone";
import type { GenericEndpointContext } from "better-auth";
import { getSessionFromCtx } from "better-auth/api";

import { runDetached } from "./email";
import type { EmailDeliveryOptions } from "./email";

/**
 * Cabut semua sesi pengguna selain sesi request ini. Sinkron (sebelum
 * respons): penyerang yang memegang sesi lain tidak sempat memakainya.
 */
const revokeOtherSessions = async (
  ctx: GenericEndpointContext,
  userId: string
): Promise<void> => {
  const current = await getSessionFromCtx(ctx);
  const sessions = await ctx.context.internalAdapter.listSessions(userId);
  const others = sessions
    .map((session) => session.token)
    .filter((token) => token !== current?.session.token);
  if (others.length > 0) {
    await ctx.context.internalAdapter.deleteSessions(others);
  }
};

/**
 * `callbackOnVerification` plugin `phoneNumber` (B16). Hanya jalur
 * `updatePhoneNumber` + sesi yang lolos `phoneBefore`, jadi dipanggil tepat
 * setelah nomor akun ditambah atau diganti:
 * 1. Semua sesi lain dicabut (sinkron).
 * 2. Notifikasi "nomor telepon diubah" ke email akun, di latar
 *    (`waitUntil`); gagal kirim hanya ke log, perubahan nomor tetap sah.
 */
export const createPhoneVerifiedCallback =
  (options: EmailDeliveryOptions) =>
  async (
    data: { phoneNumber: string; user: { id: string; email: string } },
    ctx?: GenericEndpointContext
  ): Promise<void> => {
    if (ctx) {
      await revokeOtherSessions(ctx, data.user.id);
    }
    const changedAt = new Date();
    await runDetached(
      async () =>
        await sendPhoneNumberChanged(options.emailSender, {
          changedAt,
          maskedPhoneNumber: maskPhone(data.phoneNumber),
          to: data.user.email,
          userId: data.user.id,
        }),
      options
    );
  };
