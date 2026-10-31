import { IconAlertTriangle, IconMapOff } from "@tabler/icons-react";

import { ErrorPage } from "./error-page";

export const NotFound = () => (
  <ErrorPage
    description="Halaman yang kamu cari tidak ada atau sudah dipindahkan. Periksa kembali alamatnya."
    eyebrow="Error 404"
    icon={<IconMapOff />}
    title="Halaman tidak ditemukan"
  />
);

export const ServerError = () => (
  <ErrorPage
    description="Terjadi kesalahan di sisi kami. Coba muat ulang halaman beberapa saat lagi."
    eyebrow="Terjadi kesalahan"
    icon={<IconAlertTriangle />}
    iconClassName="bg-destructive text-destructive-foreground"
    title="Halaman gagal dimuat"
  />
);
