import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, vi } from "vitest";

type TurnstileApi = NonNullable<Window["turnstile"]>;

/**
 * Turnstile palsu di `window`: skrip Cloudflare tidak pernah dimuat (tanpa
 * jaringan). Render mencatat opsi agar `error-callback` bisa dipicu.
 */
export const fakeTurnstile = {
  remove: vi.fn<TurnstileApi["remove"]>(),
  render: vi.fn<TurnstileApi["render"]>(() => "widget-palsu"),
  reset: vi.fn<TurnstileApi["reset"]>(),
};

/** Pasang Turnstile palsu dan bersihkan DOM tiap test. */
export const installFakeTurnstile = (): void => {
  beforeEach(() => {
    window.turnstile = fakeTurnstile;
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    delete window.turnstile;
  });
};

/** Render di dalam router stub (`Form`, `useNavigation` butuh data router). */
export const renderInRouter = (element: ReactNode) => {
  const Stub = createRoutesStub([{ Component: () => element, path: "/" }]);
  return render(<Stub initialEntries={["/"]} />);
};

/** Teks semua elemen `role="alert"` (pesan form, error field, widget). */
export const alertTexts = async (): Promise<string[]> => {
  const alerts = await screen.findAllByRole("alert");
  return alerts.map((alert) => alert.textContent);
};
