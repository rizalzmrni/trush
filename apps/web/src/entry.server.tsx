import { renderToReadableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import type { EntryContext, RouterContextProvider } from "react-router";

import { getWebEnv } from "./lib/cloudflare";
import { NonceContext } from "./lib/nonce";
import {
  applySecurityHeaders,
  createNonce,
} from "./lib/security-headers.server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: RouterContextProvider
): Promise<Response> {
  const env = getWebEnv(loadContext);
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

  // Situs marketing: tunggu render penuh agar crawler dan pengguna menerima
  // HTML lengkap (tanpa streaming bertahap).
  await body.allReady;

  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  applySecurityHeaders(responseHeaders, { env, nonce });

  return new Response(body, { headers: responseHeaders, status });
}
