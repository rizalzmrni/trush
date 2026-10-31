import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@trush/design-system/components/ui/card";
import type { ReactNode } from "react";

interface PageCardProps {
  children: ReactNode;
  description: ReactNode;
  /** Tautan ke halaman auth lain, mis. "Belum punya akun? Daftar". */
  footer: ReactNode;
  title: ReactNode;
}

/** Kerangka halaman auth: kartu tunggal di tengah layar. */
export const PageCard = ({
  children,
  description,
  footer,
  title,
}: PageCardProps) => (
  <main
    className="flex min-h-svh w-full flex-col items-center justify-center gap-6 px-4 py-12"
    id="main"
  >
    <p className="text-muted-foreground text-sm font-medium">trush</p>
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
      <CardFooter className="text-muted-foreground justify-center text-sm">
        {footer}
      </CardFooter>
    </Card>
  </main>
);
