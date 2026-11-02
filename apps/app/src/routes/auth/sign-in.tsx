import { FormMessage } from "@trush/design-system/components/form/form-message";
import { redirect } from "react-router";

import { signInAction } from "../../features/auth/actions.server";
import { PageCard } from "../../features/auth/forms/page-card";
import { SignInForm } from "../../features/auth/forms/sign-in";
import { SwitchLink } from "../../features/auth/forms/switch-link";
import { noticeFromUrl } from "../../features/auth/notices";
import {
  redirectFromUrl,
  SIGN_UP_PATH,
} from "../../features/auth/safe-redirect";
import { getOptionalSession } from "../../features/auth/session.server";
import {
  EMAIL_PARAM,
  emailFromQuery,
} from "../../features/email-verification/form-schema";
import { getAppEnv } from "../../lib/cloudflare";
import type { RouteHandle } from "../../lib/route-handle";
import type { Route } from "./+types/sign-in";

export const handle = { turnstile: true } satisfies RouteHandle;

export const meta: Route.MetaFunction = () => [{ title: "Masuk · trush" }];

export const loader = async ({ context, request }: Route.LoaderArgs) => {
  const redirectTo = redirectFromUrl(request.url);
  if (await getOptionalSession({ context, request })) {
    throw redirect(redirectTo);
  }
  // Pesan sukses (verifikasi email / reset kata sandi) dan email awal hanya
  // ikut bila ada di URL.
  const notice = noticeFromUrl(request.url);
  const email = emailFromQuery(
    new URL(request.url).searchParams.get(EMAIL_PARAM)
  );
  return {
    ...(email ? { email } : {}),
    ...(notice ? { notice } : {}),
    redirectTo,
    turnstileSiteKey: getAppEnv(context).VITE_TURNSTILE_SITE_KEY,
  };
};

export const action = ({ context, request }: Route.ActionArgs) =>
  signInAction({ context, request });

const SignIn = ({ actionData, loaderData }: Route.ComponentProps) => (
  <PageCard
    description="Masuk dengan email dan kata sandi akunmu."
    footer={
      <p>
        Belum punya akun?{" "}
        <SwitchLink redirectTo={loaderData.redirectTo} to={SIGN_UP_PATH}>
          Daftar
        </SwitchLink>
      </p>
    }
    title="Masuk ke trush"
  >
    {loaderData.notice && !actionData ? (
      <FormMessage className="mb-5" variant="success">
        {loaderData.notice}
      </FormMessage>
    ) : null}
    <SignInForm
      defaultEmail={loaderData.email}
      redirectTo={loaderData.redirectTo}
      result={actionData}
      turnstileSiteKey={loaderData.turnstileSiteKey}
    />
  </PageCard>
);
export default SignIn;
