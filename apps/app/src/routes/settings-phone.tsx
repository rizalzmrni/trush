import { IconArrowLeft } from "@tabler/icons-react";
import { buttonVariants } from "@trush/design-system/components/ui/button";
import { Link } from "react-router";

import { SignOutButton } from "../features/auth/forms/sign-out-button";
import { requireSession } from "../features/auth/session.server";
import { phoneAction } from "../features/phone/actions.server";
import { PhoneSettings } from "../features/phone/settings";
import { getAppEnv } from "../lib/cloudflare";
import type { RouteHandle } from "../lib/route-handle";
import type { Route } from "./+types/settings-phone";

export const handle = { turnstile: true } satisfies RouteHandle;

export const meta: Route.MetaFunction = () => [
  { title: "Nomor telepon · trush" },
];

export const loader = async ({ context, request }: Route.LoaderArgs) => {
  const { user } = await requireSession({ context, request });
  return {
    phoneNumber: user.phoneNumber ?? null,
    phoneNumberVerified: user.phoneNumberVerified ?? false,
    turnstileSiteKey: getAppEnv(context).VITE_TURNSTILE_SITE_KEY,
  };
};

export const action = async ({ context, request }: Route.ActionArgs) => {
  // Action juga terproteksi: tanpa sesi → redirect ke /sign-in.
  await requireSession({ context, request });
  return phoneAction({ context, request });
};

const SettingsPhone = ({ actionData, loaderData }: Route.ComponentProps) => (
  <div className="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-8 px-4 py-8 md:py-12">
    <header className="flex items-center justify-between gap-4">
      <Link className={buttonVariants({ variant: "ghost" })} to="/">
        <IconArrowLeft aria-hidden="true" data-icon="inline-start" />
        Beranda
      </Link>
      <SignOutButton />
    </header>
    <main className="flex flex-col gap-6" id="main">
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">
        Nomor telepon
      </h1>
      <PhoneSettings
        phoneNumber={loaderData.phoneNumber}
        phoneNumberVerified={loaderData.phoneNumberVerified}
        result={actionData}
        turnstileSiteKey={loaderData.turnstileSiteKey}
      />
    </main>
  </div>
);
export default SettingsPhone;
