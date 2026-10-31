import type { ReactNode } from "react";
import { Link } from "react-router";

import { DEFAULT_REDIRECT, REDIRECT_PARAM } from "../safe-redirect";

interface SwitchLinkProps {
  children: ReactNode;
  /** Tujuan setelah login, ikut dibawa ke halaman auth lain. */
  redirectTo: string;
  to: string;
}

/**
 * Tautan teks antarhalaman auth. Warna `foreground` + garis bawah: `primary`
 * terang tidak cukup kontras sebagai warna teks di atas latar terang.
 */
export const SwitchLink = ({ children, redirectTo, to }: SwitchLinkProps) => (
  <Link
    className="text-foreground focus-visible:ring-ring/50 rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-3"
    to={
      redirectTo === DEFAULT_REDIRECT
        ? to
        : `${to}?${new URLSearchParams({ [REDIRECT_PARAM]: redirectTo })}`
    }
  >
    {children}
  </Link>
);
