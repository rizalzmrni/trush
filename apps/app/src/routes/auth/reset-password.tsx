import { IconArrowRight } from "@tabler/icons-react";
import { FormMessage } from "@trush/design-system/components/form/form-message";
import { buttonVariants } from "@trush/design-system/components/ui/button";
import { Link } from "react-router";

import { PageCard } from "../../features/auth/forms/page-card";
import { SwitchLink } from "../../features/auth/forms/switch-link";
import {
  DEFAULT_REDIRECT,
  FORGOT_PASSWORD_PATH,
  SIGN_IN_PATH,
} from "../../features/auth/safe-redirect";
import { resetPasswordAction } from "../../features/password-reset/actions.server";
import {
  ERROR_PARAM,
  TOKEN_PARAM,
} from "../../features/password-reset/form-schema";
import { ResetPasswordForm } from "../../features/password-reset/reset-password-form";
import type { Route } from "./+types/reset-password";

export const meta: Route.MetaFunction = () => [
  { title: "Buat kata sandi baru · trush" },
  // Token ada di URL: jangan sampai halaman ini diindeks.
  { content: "noindex", name: "robots" },
];

/**
 * Token dari tautan email (`?token=`). `?error=INVALID_TOKEN` (api menolak
 * tautan) atau tanpa token → tampilan tautan tidak berlaku.
 */
export const loader = ({ request }: Route.LoaderArgs) => {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get(TOKEN_PARAM)?.trim();
  return {
    token: token && !searchParams.has(ERROR_PARAM) ? token : null,
  };
};

export const action = ({ context, request }: Route.ActionArgs) =>
  resetPasswordAction({ context, request });

const InvalidLink = () => (
  <div className="flex flex-col gap-5">
    <FormMessage>
      Tautan reset kata sandi tidak berlaku, sudah dipakai, atau sudah
      kedaluwarsa.
    </FormMessage>
    <Link className={buttonVariants({ size: "lg" })} to={FORGOT_PASSWORD_PATH}>
      Minta tautan baru
      <IconArrowRight aria-hidden="true" data-icon="inline-end" />
    </Link>
  </div>
);

const ResetPassword = ({ actionData, loaderData }: Route.ComponentProps) => {
  const invalid = !loaderData.token || actionData?.status === "invalid-token";
  return (
    <PageCard
      description={
        invalid
          ? "Minta tautan baru untuk mengganti kata sandi."
          : "Buat kata sandi baru untuk akunmu."
      }
      footer={
        <p>
          Kembali ke{" "}
          <SwitchLink redirectTo={DEFAULT_REDIRECT} to={SIGN_IN_PATH}>
            halaman masuk
          </SwitchLink>
        </p>
      }
      title="Buat kata sandi baru"
    >
      {invalid || !loaderData.token ? (
        <InvalidLink />
      ) : (
        <ResetPasswordForm
          result={actionData?.status === "error" ? actionData : undefined}
          token={loaderData.token}
        />
      )}
    </PageCard>
  );
};
export default ResetPassword;
