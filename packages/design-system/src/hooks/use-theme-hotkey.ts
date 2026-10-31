import { useTheme } from "next-themes";
import { useEffect } from "react";

const HOTKEY = "d";

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.closest("input, textarea, select, [role='textbox']") !== null);

/** Tombol `d` menukar tema terang/gelap, kecuali saat mengetik di kontrol form. */
export const useThemeHotkey = (): void => {
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const hasModifier =
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
      if (
        event.key !== HOTKEY ||
        event.repeat ||
        hasModifier ||
        event.defaultPrevented ||
        isTypingTarget(event.target)
      ) {
        return;
      }
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resolvedTheme, setTheme]);
};
