import type { ApiEnv } from "@trush/env/api";

/** Binding Worker; tipe `Env` dihasilkan `wrangler types`. */
export type Bindings = Env;

/** Nilai per request yang dipasang middleware dan dibaca route lewat `c.var`. */
export interface Variables {
  /** Env tervalidasi `createApiEnv`, dibuat per request dari `c.env`. */
  env: ApiEnv;
  requestId: string;
}

/** Generic `Env` Hono untuk `OpenAPIHono` dan `createMiddleware`. */
export interface AppContext {
  Bindings: Bindings;
  Variables: Variables;
}
