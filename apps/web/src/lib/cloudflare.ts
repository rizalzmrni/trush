import { createWebEnv } from "@trush/env/web";
import type { WebEnv } from "@trush/env/web";
import { createContext } from "react-router";
import type { RouterContextProvider } from "react-router";

export interface CloudflareContext {
  readonly ctx: ExecutionContext;
  readonly env: Env;
}

/** Diisi `src/worker.ts` per request lewat `context.set(...)`. */
export const cloudflareContext = createContext<CloudflareContext>();

/** Binding & `ctx` Worker; hanya dipanggil di loader/action/entry.server. */
export const getCloudflare = (
  context: Readonly<RouterContextProvider>
): CloudflareContext => context.get(cloudflareContext);

/**
 * Env tervalidasi untuk request ini. `VITE_*` dibakar saat build
 * (`import.meta.env`), sisanya dari binding Worker.
 */
export const getWebEnv = (context: Readonly<RouterContextProvider>): WebEnv =>
  createWebEnv({
    isServer: true,
    runtimeEnv: { ...import.meta.env, ...getCloudflare(context).env },
  });
