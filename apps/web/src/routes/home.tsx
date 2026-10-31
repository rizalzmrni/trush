import { buttonVariants } from "@trush/design-system/components/ui/button";

import { getWebEnv } from "../lib/cloudflare";
import { pageMeta } from "../lib/seo";
import type { Route } from "./+types/home";

export const loader = ({ context }: Route.LoaderArgs) => ({
  appUrl: getWebEnv(context).VITE_APP_URL,
});

export const meta: Route.MetaFunction = ({ matches }) =>
  pageMeta(matches[0]?.loaderData, {
    description:
      "trush membantu tim kecil mengelola pekerjaan harian dalam satu tempat. Halaman ini masih placeholder dan akan segera diperbarui.",
    path: "/",
    title: "Beranda",
  });

// Placeholder: section marketing nyata menyusul di src/features/home/.
const Home = ({ loaderData }: Route.ComponentProps) => {
  const { appUrl } = loaderData;
  return (
    <main
      className="mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-center gap-8 px-4 py-16 text-center"
      id="main"
    >
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm font-medium">trush</p>
        <h1 className="text-foreground text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Kelola pekerjaan tim dalam satu tempat
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">
          Situs ini masih dalam pengembangan. Kamu sudah bisa masuk atau
          mendaftar ke aplikasi.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          className={buttonVariants({ size: "lg" })}
          href={new URL("/sign-up", appUrl).href}
        >
          Mulai gratis
        </a>
        <a
          className={buttonVariants({ size: "lg", variant: "outline" })}
          href={new URL("/sign-in", appUrl).href}
        >
          Masuk
        </a>
      </div>
    </main>
  );
};
export default Home;
