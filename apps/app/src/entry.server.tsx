import { renderToReadableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import type { EntryContext, RouterContextProvider } from "react-router";

import { getAppEnv } from "./lib/cloudflare";
import { NonceContext } from "./lib/nonce";
import { needsTurnstile } from "./lib/route-handle";
import {
  applySecurityHeaders,
  createNonce,
} from "./lib/security-headers.server";

const matchedHandles = (routerContext: EntryContext): unknown[] =>
  routerContext.staticHandlerContext.matches.map(
    (match) => routerContext.routeModules[match.route.id]?.handle
  );

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: RouterContextProvider
): Promise<Response> {
  const env = getAppEnv(loadContext);
  const nonce = createNonce();
  let status = responseStatusCode;

  const body = await renderToReadableStream(
    <NonceContext value={nonce}>
      <ServerRouter context={routerContext} nonce={nonce} url={request.url} />
    </NonceContext>,
    {
      nonce,
      // Hanya menandai status. Nilai kembalian onError menjadi `digest` yang
      // terkirim ke browser, jadi pesan error sengaja tidak dikembalikan.
      onError() {
        status = 500;
      },
      signal: request.signal,
    }
  );

  // Data halaman sudah dimuat loader; tunggu render penuh agar status HTTP
  // akhir (mis. 500 dari onError) masih bisa dipasang.
  await body.allReady;

  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  applySecurityHeaders(responseHeaders, {
    env,
    nonce,
    requestUrl: request.url,
    turnstile: needsTurnstile(matchedHandles(routerContext)),
  });

  return new Response(body, { headers: responseHeaders, status });
}
