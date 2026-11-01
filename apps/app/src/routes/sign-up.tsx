import { redirect } from "react-router";

import { signUpAction } from "../features/auth/actions.server";
import { PageCard } from "../features/auth/forms/page-card";
import { SignUpForm } from "../features/auth/forms/sign-up";
import { SwitchLink } from "../features/auth/forms/switch-link";
import { redirectFromUrl, SIGN_IN_PATH } from "../features/auth/safe-redirect";
import { getOptionalSession } from "../features/auth/session.server";
import { getAppEnv } from "../lib/cloudflare";
import type { RouteHandle } from "../lib/route-handle";
import type { Route } from "./+types/sign-up";

export const handle = { turnstile: true } satisfies RouteHandle;

export const meta: Route.MetaFunction = () => [{ title: "Daftar · trush" }];

export const loader = async ({ context, request }: Route.LoaderArgs) => {
  const redirectTo = redirectFromUrl(request.url);
  if (await getOptionalSession({ context, request })) {
    throw redirect(redirectTo);
  }
  return {
    redirectTo,
    turnstileSiteKey: getAppEnv(context).VITE_TURNSTILE_SITE_KEY,
  };
};

export const action = ({ context, request }: Route.ActionArgs) =>
  signUpAction({ context, request });

const SignUp = ({ actionData, loaderData }: Route.ComponentProps) => (
  <PageCard
    description="Buat akun gratis dengan email dan kata sandi."
    footer={
      <p>
        Sudah punya akun?{" "}
        <SwitchLink redirectTo={loaderData.redirectTo} to={SIGN_IN_PATH}>
          Masuk
        </SwitchLink>
      </p>
    }
    title="Daftar ke trush"
  >
    <SignUpForm
      redirectTo={loaderData.redirectTo}
      result={actionData}
      turnstileSiteKey={loaderData.turnstileSiteKey}
    />
  </PageCard>
);
export default SignUp;
