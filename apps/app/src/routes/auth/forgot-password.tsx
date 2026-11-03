import { PageCard } from "../../features/auth/forms/page-card";
import { SwitchLink } from "../../features/auth/forms/switch-link";
import {
  redirectFromUrl,
  SIGN_IN_PATH,
} from "../../features/auth/safe-redirect";
import { forgotPasswordAction } from "../../features/password-reset/actions.server";
import { ForgotPasswordForm } from "../../features/password-reset/forgot-password-form";
import { getAppEnv } from "../../lib/cloudflare";
import type { RouteHandle } from "../../lib/route-handle";
import type { Route } from "./+types/forgot-password";

export const handle = { turnstile: true } satisfies RouteHandle;

export const meta: Route.MetaFunction = () => [
  { title: "Lupa kata sandi · trush" },
];

export const loader = ({ context, request }: Route.LoaderArgs) => ({
  redirectTo: redirectFromUrl(request.url),
  turnstileSiteKey: getAppEnv(context).VITE_TURNSTILE_SITE_KEY,
});

export const action = ({ context, request }: Route.ActionArgs) =>
  forgotPasswordAction({ context, request });

const ForgotPassword = ({ actionData, loaderData }: Route.ComponentProps) => (
  <PageCard
    description="Masukkan email akunmu. Kami kirim tautan untuk membuat kata sandi baru."
    footer={
      <p>
        Ingat kata sandimu?{" "}
        <SwitchLink redirectTo={loaderData.redirectTo} to={SIGN_IN_PATH}>
          Masuk
        </SwitchLink>
      </p>
    }
    title="Lupa kata sandi"
  >
    <ForgotPasswordForm
      result={actionData}
      turnstileSiteKey={loaderData.turnstileSiteKey}
    />
  </PageCard>
);
export default ForgotPassword;
