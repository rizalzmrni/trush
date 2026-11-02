import { redirect } from "react-router";

import { PageCard } from "../../features/auth/forms/page-card";
import { SwitchLink } from "../../features/auth/forms/switch-link";
import {
  redirectFromUrl,
  SIGN_IN_PATH,
} from "../../features/auth/safe-redirect";
import { getOptionalSession } from "../../features/auth/session.server";
import { verifyEmailAction } from "../../features/email-verification/actions.server";
import {
  EMAIL_PARAM,
  emailFromQuery,
  REASON_PARAM,
  reasonNotice,
} from "../../features/email-verification/form-schema";
import { EmailVerification } from "../../features/email-verification/verification";
import { getAppEnv } from "../../lib/cloudflare";
import type { RouteHandle } from "../../lib/route-handle";
import type { Route } from "./+types/verify-email";

export const handle = { turnstile: true } satisfies RouteHandle;

export const meta: Route.MetaFunction = () => [
  { title: "Verifikasi email · trush" },
];

export const loader = async ({ context, request }: Route.LoaderArgs) => {
  const redirectTo = redirectFromUrl(request.url);
  // Sesi hanya ada untuk akun terverifikasi; tidak ada yang perlu dilakukan.
  if (await getOptionalSession({ context, request })) {
    throw redirect(redirectTo);
  }
  const { searchParams } = new URL(request.url);
  return {
    email: emailFromQuery(searchParams.get(EMAIL_PARAM)) ?? null,
    notice: reasonNotice(searchParams.get(REASON_PARAM)) ?? null,
    redirectTo,
    turnstileSiteKey: getAppEnv(context).VITE_TURNSTILE_SITE_KEY,
  };
};

export const action = ({ context, request }: Route.ActionArgs) =>
  verifyEmailAction({ context, request });

const VerifyEmail = ({ actionData, loaderData }: Route.ComponentProps) => (
  <PageCard
    description="Masukkan kode yang kami kirim ke emailmu untuk mengaktifkan akun."
    footer={
      <p>
        Sudah terverifikasi?{" "}
        <SwitchLink redirectTo={loaderData.redirectTo} to={SIGN_IN_PATH}>
          Masuk
        </SwitchLink>
      </p>
    }
    title="Verifikasi email"
  >
    <EmailVerification
      email={loaderData.email}
      notice={loaderData.notice}
      redirectTo={loaderData.redirectTo}
      result={actionData}
      turnstileSiteKey={loaderData.turnstileSiteKey}
    />
  </PageCard>
);
export default VerifyEmail;
