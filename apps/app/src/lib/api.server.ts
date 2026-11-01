import type { RouterContextProvider } from "react-router";

import { createApiClient, createApiFetch } from "./api-client";
import type { ServerApiOptions } from "./api-client";
import { getAppEnv, getCloudflare } from "./cloudflare";

export interface RequestScope {
  readonly context: Readonly<RouterContextProvider>;
  readonly request: Request;
}

/** Opsi mode server untuk request ini: Service Binding `API` + header asli. */
export const serverApiOptions = ({
  context,
  request,
}: RequestScope): ServerApiOptions => ({
  api: getCloudflare(context).env.API,
  baseUrl: getAppEnv(context).VITE_API_URL,
  mode: "server",
  request,
});

/** Klien RPC api untuk loader/action. */
export const serverApiClient = (scope: RequestScope) =>
  createApiClient(serverApiOptions(scope));

/** `fetch` mentah api (mis. `/api/auth/*`) untuk loader/action. */
export const serverApiFetch = (scope: RequestScope) =>
  createApiFetch(serverApiOptions(scope));
