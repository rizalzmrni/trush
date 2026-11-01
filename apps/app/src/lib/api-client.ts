import { hcWithType } from "@trush/api/client";
import type { Client } from "@trush/api/client";
import { errorResponseSchema } from "@trush/core/schemas/error";
import { createAppEnv } from "@trush/env/app";
import type { z } from "zod";

/**
 * Header request asli yang diteruskan ke api saat SSR: sesi (`cookie`), cek
 * CSRF better-auth (`origin`), rate limit per pengguna (`cf-connecting-ip`),
 * dan `user-agent` untuk metadata sesi.
 */
export const FORWARDED_HEADERS = [
  "cookie",
  "origin",
  "cf-connecting-ip",
  "user-agent",
] as const;

export interface ServerApiOptions {
  /** Service Binding `API` (`getCloudflare(context).env.API`). */
  readonly api: Fetcher;
  /**
   * Origin URL request. Host-nya tidak menentukan tujuan (selalu lewat
   * binding); dipakai agar path sama dengan mode browser.
   */
  readonly baseUrl: string;
  readonly mode: "server";
  /** Request dokumen/action asli; sumber header yang diteruskan. */
  readonly request: Request;
}

export interface BrowserApiOptions {
  /** `VITE_API_URL`. */
  readonly baseUrl: string;
  readonly mode: "browser";
}

export type ApiClientOptions = BrowserApiOptions | ServerApiOptions;

export type ApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

const serverFetch =
  ({ api, request }: ServerApiOptions): ApiFetch =>
  (input, init) => {
    const headers = new Headers(init?.headers);
    for (const name of FORWARDED_HEADERS) {
      const value = request.headers.get(name);
      if (value !== null && !headers.has(name)) {
        headers.set(name, value);
      }
    }
    return api.fetch(input, { ...init, headers });
  };

// Cookie sesi milik domain api ikut terkirim lintas origin.
const browserFetch: ApiFetch = (input, init) =>
  fetch(input, { ...init, credentials: "include" });

/** `fetch` mentah ke api, untuk endpoint di luar tipe RPC (`/api/auth/*`). */
export const createApiFetch = (options: ApiClientOptions): ApiFetch => {
  const base = new URL(options.baseUrl);
  const doFetch =
    options.mode === "server" ? serverFetch(options) : browserFetch;
  return (input, init) =>
    doFetch(typeof input === "string" ? new URL(input, base) : input, init);
};

/**
 * Satu-satunya factory klien api di app (`docs/react-router.md`). Server:
 * lewat Service Binding dengan header request asli. Browser: `VITE_API_URL`
 * dengan `credentials: "include"`.
 */
export const createApiClient = (options: ApiClientOptions): Client =>
  hcWithType(options.baseUrl, { fetch: createApiFetch(options) });

const HTTP_SERVER_ERROR = 500;

/** Response api non-2xx; `code` dari `ErrorResponse` bila ada. */
export class ApiError extends Error {
  readonly code: string | undefined;
  readonly status: number;

  constructor(status: number, code?: string) {
    super(`Permintaan api gagal (${status}${code ? ` ${code}` : ""}).`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** 4xx: kesalahan permintaan, tidak perlu diulang. */
  get isClientError(): boolean {
    return this.status < HTTP_SERVER_ERROR;
  }
}

/** Bagian Response yang dibaca; cocok untuk `Response` maupun response RPC. */
interface JsonResponse {
  readonly ok: boolean;
  readonly status: number;
  json: () => Promise<unknown>;
}

const readErrorCode = async (
  response: JsonResponse
): Promise<string | undefined> => {
  try {
    const parsed = errorResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.error.code : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Body JSON response sukses yang divalidasi skema kontrak `@trush/core`;
 * response gagal dilempar sebagai `ApiError`.
 */
export const readApiJson = async <Schema extends z.ZodType>(
  response: JsonResponse,
  schema: Schema
): Promise<z.output<Schema>> => {
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorCode(response));
  }
  return schema.parse(await response.json());
};

let browserClient: Client | undefined;

/**
 * Klien browser (satu per tab) untuk `queryFn` yang berjalan di klien. Jangan
 * dipanggil di loader/action: di server pakai mode `server` per request.
 */
export const getBrowserApiClient = (): Client => {
  if (typeof window === "undefined") {
    throw new TypeError(
      "getBrowserApiClient hanya untuk browser; di server pakai mode server."
    );
  }
  browserClient ??= createApiClient({
    baseUrl: createAppEnv({ isServer: false, runtimeEnv: import.meta.env })
      .VITE_API_URL,
    mode: "browser",
  });
  return browserClient;
};
