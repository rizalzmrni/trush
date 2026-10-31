/**
 * Klien RPC bertipe `@trush/api/client` untuk `apps/app` dan `apps/web`.
 * Hanya `import type` dari server: tidak ada kode api yang ikut ke bundle
 * konsumen. Konsumen membaca tipenya dari `dist/types` (`build:types`).
 */
import { hc } from "hono/client";

import type { AppType } from "./index";

export type Client = ReturnType<typeof hc<AppType>>;

/** `hc<AppType>` yang tipenya sudah di-compile; pakai ini, bukan `hc` langsung. */
export const hcWithType = (...args: Parameters<typeof hc>): Client =>
  hc<AppType>(...args);

export type { AppType } from "./index";
