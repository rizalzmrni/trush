/**
 * `handle` route yang dibaca `entry.server.tsx`. Route form auth mengekspor
 * `handle = { turnstile: true } satisfies RouteHandle` agar CSP-nya mengizinkan
 * Turnstile; route lain tidak.
 */
export interface RouteHandle {
  readonly turnstile?: boolean;
}

const isRouteHandle = (value: unknown): value is RouteHandle =>
  typeof value === "object" && value !== null;

/** Apakah salah satu route yang cocok memuat widget Turnstile. */
export const needsTurnstile = (handles: readonly unknown[]): boolean =>
  handles.some((handle) => isRouteHandle(handle) && handle.turnstile === true);
