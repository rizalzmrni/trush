import { redirect } from "react-router";

import { signInAction } from "../features/auth/actions.server";
import { PageCard } from "../features/auth/forms/page-card";
import { SignInForm } from "../features/auth/forms/sign-in";
import { SwitchLink } from "../features/auth/forms/switch-link";
import { redirectFromUrl, SIGN_UP_PATH } from "../features/auth/safe-redirect";
import { getOptionalSession } from "../features/auth/session.server";
import { getAppEnv } from "../lib/cloudflare";
import type { RouteHandle } from "../lib/route-handle";
import type { Route } from "./+types/sign-in";

export const handle = { turnstile: true } satisfies RouteHandle;

export const meta: Route.MetaFunction = () => [{ title: "Masuk · trush" }];

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
    <SignInForm
      redirectTo={loaderData.redirectTo}
      result={actionData}
      turnstileSiteKey={loaderData.turnstileSiteKey}
    />
  </PageCard>
);
export default SignIn;
