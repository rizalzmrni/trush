import { buttonVariants } from "@trush/design-system/components/ui/button";
import { cn } from "@trush/design-system/lib/utils";
import type { ReactNode } from "react";
import { Link } from "react-router";

interface ErrorPageProps {
  description: ReactNode;
  /** Ikon Tabler dekoratif; makna dibawa oleh `eyebrow` + `title`. */
  icon: ReactNode;
  title: ReactNode;
  /** Label singkat di atas judul, mis. "Error 404". */
  eyebrow: ReactNode;
  /** Kelas warna permukaan ikon (token semantik). */
  iconClassName?: string;
}

/** Kerangka halaman error/404 situs marketing (layar penuh, satu aksi). */
export const ErrorPage = ({
  description,
  eyebrow,
  icon,
  iconClassName = "bg-muted text-muted-foreground",
  title,
}: ErrorPageProps) => (
  <main
    className="mx-auto flex min-h-svh w-full max-w-xl flex-col items-center justify-center gap-6 px-4 py-16 text-center"
    id="main"
  >
    <div
      aria-hidden="true"
      className={cn(
        "flex size-12 items-center justify-center rounded-lg [&_svg]:size-6",
        iconClassName
      )}
    >
      {icon}
    </div>
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm font-medium">{eyebrow}</p>
      <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
        {title}
      </h1>
      <p className="text-muted-foreground text-pretty">{description}</p>
    </div>
    <Link className={buttonVariants({ size: "lg" })} to="/">
      Kembali ke beranda
    </Link>
  </main>
);
