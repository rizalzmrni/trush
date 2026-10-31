import { queryOptions } from "@tanstack/react-query";
import type { Client } from "@trush/api/client";
import {
  meOrganizationsResponseSchema,
  meResponseSchema,
} from "@trush/core/schemas/me";

import { readApiJson } from "../../lib/api-client";
import { accountKeys } from "./query-keys";

/**
 * Klien diambil saat `queryFn` berjalan: loader memberi klien server per
 * request, komponen memberi `getBrowserApiClient` (tidak dipanggil saat SSR).
 */
type GetClient = () => Client;

/** `GET /api/me`: pengguna & sesi aktif. */
export const meQueryOptions = (getClient: GetClient) =>
  queryOptions({
    queryFn: async () =>
      readApiJson(await getClient().api.me.$get(), meResponseSchema),
    queryKey: accountKeys.me(),
  });

/** `GET /api/me/organizations`: organisasi pengguna, urut nama. */
export const organizationsQueryOptions = (getClient: GetClient) =>
  queryOptions({
    queryFn: async () =>
      readApiJson(
        await getClient().api.me.organizations.$get(),
        meOrganizationsResponseSchema
      ),
    queryKey: accountKeys.organizations(),
  });
