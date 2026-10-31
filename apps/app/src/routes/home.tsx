import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { OrganizationList } from "../features/account/organization-list";
import { ProfileCard } from "../features/account/profile-card";
import { organizationsQueryOptions } from "../features/account/queries";
import { accountKeys } from "../features/account/query-keys";
import { SignOutButton } from "../features/auth/forms/sign-out-button";
import { requireSession } from "../features/auth/session.server";
import { serverApiClient } from "../lib/api.server";
import { createQueryClient } from "../lib/query-client";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [{ title: "Beranda · trush" }];

export const loader = async ({ context, request }: Route.LoaderArgs) => {
  const me = await requireSession({ context, request });
  // QueryClient baru per request; hasilnya di-dehydrate ke klien.
  const queryClient = createQueryClient();
  queryClient.setQueryData(accountKeys.me(), me);
  const client = serverApiClient({ context, request });
  // Gagal tidak menggagalkan halaman: daftar menampilkan state error-nya.
  await queryClient.prefetchQuery(organizationsQueryOptions(() => client));
  return { dehydratedState: dehydrate(queryClient) };
};

const Home = ({ loaderData }: Route.ComponentProps) => (
  <HydrationBoundary state={loaderData.dehydratedState}>
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-8 md:py-12">
      <header className="flex items-center justify-between gap-4">
        <p className="text-foreground text-lg font-semibold">trush</p>
        <SignOutButton />
      </header>
      <main className="flex flex-col gap-8" id="main">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Beranda
        </h1>
        <section aria-label="Profil" className="flex flex-col gap-3">
          <ProfileCard />
        </section>
        <section
          aria-labelledby="organizations-heading"
          className="flex flex-col gap-3"
        >
          <h2
            className="text-foreground text-lg font-semibold"
            id="organizations-heading"
          >
            Organisasi
          </h2>
          <OrganizationList />
        </section>
      </main>
    </div>
  </HydrationBoundary>
);
export default Home;
