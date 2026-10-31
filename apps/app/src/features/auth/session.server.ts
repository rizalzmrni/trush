import { meResponseSchema } from "@trush/core/schemas/me";
import type { MeResponse } from "@trush/core/schemas/me";
import { data, redirect } from "react-router";

import { readApiJson } from "../../lib/api-client";
import { serverApiClient } from "../../lib/api.server";
import type { RequestScope } from "../../lib/api.server";
import { signInPath } from "./safe-redirect";

const HTTP_UNAUTHORIZED = 401;

/**
 * Auth gate loader halaman terproteksi (`docs/react-router.md`): sesi dari
 * `GET /api/me` lewat Service Binding. 401 → redirect ke `/sign-in` dengan
 * `redirectTo` halaman ini; status error lain dilempar ke ErrorBoundary.
 */
export const requireSession = async ({
  context,
  request,
}: RequestScope): Promise<MeResponse> => {
  const response = await serverApiClient({ context, request }).api.me.$get();
  if (response.status === HTTP_UNAUTHORIZED) {
    const url = new URL(request.url);
    throw redirect(signInPath(`${url.pathname}${url.search}`));
  }
  if (!response.ok) {
    throw data(null, { status: response.status });
  }
  return readApiJson(response, meResponseSchema);
};

/**
 * Sesi bila ada, untuk halaman publik (mis. `/sign-in` mengalihkan pengguna
 * yang sudah login). Gagal menghubungi api dianggap tanpa sesi agar halaman
 * login tetap bisa dibuka.
 */
export const getOptionalSession = async (
  scope: RequestScope
): Promise<MeResponse | null> => {
  try {
    const response = await serverApiClient(scope).api.me.$get();
    return response.ok ? await readApiJson(response, meResponseSchema) : null;
  } catch {
    return null;
  }
};
