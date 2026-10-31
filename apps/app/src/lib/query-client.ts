import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./api-client";

// Sementara di sini sampai `@trush/data` menjadi paket workspace
// (`createQueryClient` milik paket itu menurut packages/data/CLAUDE.md).

/** > 0 agar data hasil prefetch loader tidak di-fetch ulang setelah hydration. */
const STALE_TIME_MS = 60_000;
const MAX_RETRIES = 2;

/** Hanya error jaringan/5xx yang diulang; 4xx tidak akan berubah hasilnya. */
const shouldRetry = (failureCount: number, error: unknown): boolean =>
  !(error instanceof ApiError && error.isClientError) &&
  failureCount < MAX_RETRIES;

/**
 * QueryClient baru. Server: satu per request (dibuat di loader). Browser: satu
 * per tab (dibuat sekali di root).
 */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: STALE_TIME_MS },
    },
  });
