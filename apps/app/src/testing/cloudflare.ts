import { RouterContextProvider } from "react-router";

import { cloudflareContext } from "../lib/cloudflare";

/**
 * Env uji (nilai palsu). `VITE_*` di produksi dibakar dari `import.meta.env`
 * saat build; di test diberikan lewat binding agar hasil tidak bergantung pada
 * file `.env` lokal developer (binding menimpa `import.meta.env`).
 */
export const TEST_ENV = {
  APP_ENV: "development",
  VITE_API_URL: "https://api.example.test",
  VITE_APP_ENV: "development",
  // Kunci uji publik Cloudflare Turnstile (selalu lolos), bukan secret.
  VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
} as const;

export type TestEnvOverrides = Partial<Record<keyof typeof TEST_ENV, string>>;

export type AppEnvName = "development" | "staging" | "production";

/** Lingkungan sama untuk server dan klien (`APP_ENV` = `VITE_APP_ENV`). */
export const envFor = (appEnv: AppEnvName): TestEnvOverrides => ({
  APP_ENV: appEnv,
  VITE_APP_ENV: appEnv,
});

/** Request yang diterima Service Binding `API` palsu. */
export interface RecordedApiRequest {
  readonly body: string | undefined;
  readonly headers: Headers;
  readonly method: string;
  readonly url: URL;
}

export type ApiHandler = (
  request: RecordedApiRequest
) => Response | Promise<Response>;

export interface FakeApi {
  readonly binding: Fetcher;
  /** Semua request yang masuk, berurutan. */
  readonly requests: RecordedApiRequest[];
}

const toUrl = (input: RequestInfo | URL): URL => {
  if (input instanceof URL) {
    return input;
  }
  return new URL(typeof input === "string" ? input : input.url);
};

const toBody = (body: RequestInit["body"]): string | undefined =>
  typeof body === "string" ? body : undefined;

/**
 * Service Binding `API` palsu: tidak ada request jaringan. `handler` menentukan
 * response; request dicatat untuk diperiksa (path, header, body).
 */
export const createFakeApi = (handler: ApiHandler): FakeApi => {
  const requests: RecordedApiRequest[] = [];
  const binding = {
    connect: () => {
      throw new Error("connect() tidak dipakai apps/app.");
    },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request: RecordedApiRequest = {
        body: toBody(init?.body),
        headers: new Headers(init?.headers),
        method: init?.method ?? "GET",
        url: toUrl(input),
      };
      requests.push(request);
      return await handler(request);
    },
  };
  // Hanya `fetch` yang dipakai factory api-client.
  return { binding: binding as unknown as Fetcher, requests };
};

/** Binding yang gagal bila dipanggil (route yang tidak boleh memanggil api). */
export const unusedApi = (): FakeApi =>
  createFakeApi(() => {
    throw new Error("API tidak boleh dipanggil di test ini.");
  });

/** Promise `waitUntil` yang dijadwalkan selama test. */
export const pendingWaitUntil: Promise<unknown>[] = [];

const executionContext: Pick<
  ExecutionContext,
  "passThroughOnException" | "props" | "waitUntil"
> = {
  passThroughOnException: () => {
    throw new Error("passThroughOnException tidak dipakai apps/app.");
  },
  props: {},
  waitUntil: (promise) => {
    pendingWaitUntil.push(promise);
  },
};

interface TestContextOptions {
  readonly api?: FakeApi;
  readonly env?: TestEnvOverrides;
}

/** `RouterContextProvider` berisi `cloudflareContext`, seperti `src/worker.ts`. */
export const createTestContext = ({
  api = unusedApi(),
  env: overrides = {},
}: TestContextOptions = {}): RouterContextProvider => {
  const env: Env = { ...TEST_ENV, ...overrides, API: api.binding };
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    // Loader/action hanya membaca `env`; anggota ExecutionContext lain tidak dipakai.
    ctx: executionContext as ExecutionContext,
    env,
  });
  return context;
};

/** Response JSON dari api palsu. */
export const jsonResponse = (
  body: unknown,
  init: ResponseInit = {}
): Response => Response.json(body, init);

/** Body `GET /api/me` yang valid menurut `meResponseSchema` (data palsu). */
export const ME_FIXTURE = {
  session: {
    expiresAt: "2026-12-01T00:00:00.000Z",
    id: "019a3b7c-3f40-7152-8c6d-7e8f9a0b1c2d",
  },
  user: {
    createdAt: "2026-10-31T09:00:00.000Z",
    displayUsername: null,
    email: "budi@example.test",
    emailVerified: true,
    id: "019a3b7c-1d2e-7f30-8a4b-5c6d7e8f9a0b",
    image: null,
    name: "Budi",
    role: null,
    twoFactorEnabled: false,
    username: null,
  },
} as const;

/** Cookie sesi palsu yang dikirim browser ke app. */
export const SESSION_COOKIE = "better-auth.session_token=token-palsu-123";

/** Header yang diteruskan dari request asli (lihat `FORWARDED_HEADERS`). */
export const FORWARDED_FROM_APP_REQUEST = {
  "cf-connecting-ip": "203.0.113.7",
  origin: "https://app.example.test",
  "user-agent": "trush-test/1.0",
} as const;

/** Nilai beberapa header sekaligus (`null` bila tidak ada), untuk satu assert. */
export const pickHeaders = (
  headers: Headers | undefined,
  names: readonly string[]
): Record<string, string | null> =>
  Object.fromEntries(names.map((name) => [name, headers?.get(name) ?? null]));

/** Ringkasan request api: metode + path, untuk satu assert. */
export const describeRequest = (request: RecordedApiRequest | undefined) => ({
  method: request?.method,
  path: request?.url.pathname,
});

/** Request dokumen/action ke app, dengan header khas browser. */
export const appRequest = (
  path: string,
  init: RequestInit & { readonly cookie?: string } = {}
): Request => {
  const { cookie, ...rest } = init;
  const headers = new Headers(rest.headers);
  for (const [name, value] of Object.entries(FORWARDED_FROM_APP_REQUEST)) {
    headers.set(name, value);
  }
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return new Request(new URL(path, "https://app.example.test"), {
    ...rest,
    headers,
  });
};

/** Request POST form ke action app. */
export const formRequest = (
  path: string,
  fields: Record<string, string>,
  cookie?: string
): Request =>
  appRequest(path, {
    body: new URLSearchParams(fields),
    cookie,
    method: "POST",
  });
