import { createAuth } from "@trush/auth";
import { createDb } from "@trush/db";
import { createMiddleware } from "hono/factory";

import type { AppContext } from "../context";

/**
 * Membuat klien DB dan instance better-auth per request (tidak ada klien
 * global) untuk route di bawah `/api/*`. Tugas latar better-auth diteruskan ke
 * `waitUntil` agar tidak dibatalkan setelah respons terkirim.
 */
export const authContext = createMiddleware<AppContext>(async (c, next) => {
  const { env } = c.var;
  const db = createDb(env);
  c.set("db", db);
  c.set(
    "auth",
    createAuth({
      db,
      env,
      waitUntil: (promise) => c.executionCtx.waitUntil(promise),
    })
  );
  return await next();
});
