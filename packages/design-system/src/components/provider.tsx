import { Toaster } from "@trush/design-system/components/ui/toast";
import { useThemeHotkey } from "@trush/design-system/hooks/use-theme-hotkey";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

interface DesignSystemProviderProps {
  children: ReactNode;
  /** Nonce CSP per request; next-themes menyisipkan skrip anti-kedip inline. */
  nonce?: string;
}

const ThemeHotkey = () => {
  useThemeHotkey();
  return null;
};

/**
 * Dipasang sekali di root layout app. `<html>` wajib memakai
 * `suppressHydrationWarning` karena next-themes menambah class `.dark` sebelum
 * hydration.
 */
export const DesignSystemProvider = ({
  children,
  nonce,
}: DesignSystemProviderProps) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="system"
    disableTransitionOnChange
    enableSystem
    nonce={nonce}
  >
    <ThemeHotkey />
    <Toaster>{children}</Toaster>
  </ThemeProvider>
);
