import { IconAlertTriangle, IconMapOff } from "@tabler/icons-react";
import { cn } from "@trush/design-system/lib/utils";
import type { ReactNode } from "react";

interface ErrorPageProps {
  /**
   * Satu aksi lanjut, mis. tautan router app ke beranda. Paket ini tidak
   * bergantung pada router, jadi tautannya dibuat app.
   */
  action?: ReactNode;
  description: ReactNode;
  /** Label singkat di atas judul, mis. "Error 404". */
  eyebrow: ReactNode;
  /** Ikon Tabler dekoratif; makna dibawa oleh `eyebrow` + `title`. */
  icon: ReactNode;
  /** Kelas warna permukaan ikon (token semantik). */
  iconClassName?: string;
  title: ReactNode;
}

/** Kerangka halaman error layar penuh (404, 500) dengan satu aksi. */
export const ErrorPage = ({
  action,
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
    {action}
  </main>
);

type StatusPageProps = Pick<ErrorPageProps, "action">;

/** Halaman 404 standar. */
export const NotFoundPage = ({ action }: StatusPageProps) => (
  <ErrorPage
    action={action}
    description="Halaman yang kamu cari tidak ada atau sudah dipindahkan. Periksa kembali alamatnya."
    eyebrow="Error 404"
    icon={<IconMapOff />}
    title="Halaman tidak ditemukan"
  />
);

/** Halaman error server standar; tanpa detail internal. */
export const ServerErrorPage = ({ action }: StatusPageProps) => (
  <ErrorPage
    action={action}
    description="Terjadi kesalahan di sisi kami. Coba muat ulang halaman beberapa saat lagi."
    eyebrow="Terjadi kesalahan"
    icon={<IconAlertTriangle />}
    iconClassName="bg-destructive text-destructive-foreground"
    title="Halaman gagal dimuat"
  />
);
