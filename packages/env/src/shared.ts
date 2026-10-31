import { z } from "zod";

/** Satu-satunya penanda lingkungan trush (lihat `docs/environments.md`). */
export const appEnvSchema = z.enum(["development", "staging", "production"]);

export type AppEnvName = z.infer<typeof appEnvSchema>;

/**
 * Bentuk env yang diterima factory. Binding Worker (`c.env`,
 * `getCloudflare(context).env`) boleh berisi objek seperti R2 atau Service
 * Binding; hanya nilai primitif yang diteruskan ke validasi.
 */
export type RuntimeEnvInput = Readonly<Record<string, unknown>>;

type RuntimeEnv = Record<string, string | number | boolean | undefined>;

export const toRuntimeEnv = (input: RuntimeEnvInput): RuntimeEnv => {
  const result: RuntimeEnv = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      result[key] = value;
    }
  }
  return result;
};

/** Var wrangler bisa berupa boolean JSON atau string `"true"`/`"false"`. */
export const booleanFlagSchema = z.union([z.boolean(), z.stringbool()]);

/** Menolak bila `VITE_APP_ENV` (dibakar saat build) berbeda dari `APP_ENV`. */
export const assertSameAppEnv = (
  appEnv: AppEnvName,
  viteAppEnv: AppEnvName
): void => {
  if (appEnv !== viteAppEnv) {
    throw new Error(
      `VITE_APP_ENV (${viteAppEnv}) berbeda dari APP_ENV (${appEnv}); build ulang dengan CLOUDFLARE_ENV yang sesuai.`
    );
  }
};

interface ValidationIssue {
  readonly message: string;
  readonly path?:
    | readonly (PropertyKey | { readonly key: PropertyKey })[]
    | undefined;
}

const formatPath = (issue: ValidationIssue): string =>
  (issue.path ?? [])
    .map((segment) =>
      typeof segment === "object" ? String(segment.key) : String(segment)
    )
    .join(".") || "(root)";

/**
 * Pengganti handler bawaan t3-env yang memanggil `console.error`. Pesan hanya
 * memuat nama var dan alasan, tidak pernah nilainya.
 */
export const throwEnvError = (issues: readonly ValidationIssue[]): never => {
  const details = issues
    .map((issue) => `${formatPath(issue)}: ${issue.message}`)
    .join("; ");
  throw new Error(`Env tidak valid: ${details}`);
};

/** Sama dengan deteksi bawaan t3-env, tanpa butuh lib DOM. */
export const detectServer = (): boolean => !("window" in globalThis);
