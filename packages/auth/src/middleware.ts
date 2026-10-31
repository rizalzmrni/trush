import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import type { Auth, AuthSession } from "./auth";

const HTTP_UNAUTHORIZED = 401;

/** Variabel context yang dibaca/ditulis middleware auth. */
export interface AuthVariables {
  /** Instance per request dari `createAuth`, dipasang app sebelum route. */
  auth: Auth;
  /** Sesi tervalidasi; hanya ada di route yang memakai `requireSession`. */
  authSession: AuthSession;
}

/**
 * Guard route wajib sesi: memvalidasi cookie lewat better-auth, menaruh
 * `{ session, user }` di `c.var.authSession`, atau melempar 401 (dibentuk
 * `ErrorResponse` oleh `onError` app). Pasang sebagai `middleware` di
 * `createRoute` agar tipe `authSession` sampai ke handler.
 */
export const requireSession = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const authSession = await c.var.auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (!authSession) {
      throw new HTTPException(HTTP_UNAUTHORIZED, {
        message: "Sesi tidak ada atau kedaluwarsa.",
      });
    }
    c.set("authSession", authSession);
    return await next();
  }
);
