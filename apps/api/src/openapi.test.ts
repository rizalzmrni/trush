import { errorResponseSchema } from "@trush/core/schemas/error";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { BASE_ENV, fetchWorker, requestWithEnv } from "./testing/request";

const WARMUP_TIMEOUT_MS = 30_000;
const NONCE_IN_CSP = /'nonce-(?<nonce>[^']+)'/u;

const nonceOf = (response: Response) =>
  NONCE_IN_CSP.exec(response.headers.get("content-security-policy") ?? "")
    ?.groups?.nonce;

/** Bagian dokumen OpenAPI yang diperiksa test; sisanya diabaikan. */
const operationSchema = z.looseObject({
  responses: z.record(z.string(), z.unknown()),
  summary: z.string().min(1),
  tags: z.array(z.string()).min(1),
});

const openApiDocumentSchema = z.looseObject({
  components: z.looseObject({
    schemas: z.record(z.string(), z.unknown()),
  }),
  info: z.looseObject({ title: z.string(), version: z.string() }),
  openapi: z.string().startsWith("3.1"),
  paths: z.record(z.string(), z.record(z.string(), operationSchema)),
});

type OpenApiDocument = z.infer<typeof openApiDocumentSchema>;

const jsonSchemaRef = (
  document: OpenApiDocument,
  path: string,
  method: string,
  status: string
): unknown => {
  const response = document.paths[path]?.[method]?.responses[status];
  return z
    .object({
      content: z.object({
        "application/json": z.object({ schema: z.unknown() }),
      }),
    })
    .parse(response).content["application/json"].schema;
};

let document: OpenApiDocument;

describe("GET /openapi.json", () => {
  beforeAll(async () => {
    // Juga pemanasan: request pertama di workerd lambat.
    const response = await fetchWorker("/openapi.json");
    document = openApiDocumentSchema.parse(await response.json());
  }, WARMUP_TIMEOUT_MS);

  it("200 JSON berversi OpenAPI 3.1", async () => {
    const response = await fetchWorker("/openapi.json");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^application\/json/u);
    expect(document.openapi).toMatch(/^3\.1\./u);
    expect(document.info.title).not.toBe("");
  });

  it("memuat komponen HealthResponse dan ErrorResponse dari .meta({ id })", () => {
    expect(document.components.schemas).toHaveProperty("HealthResponse");
    expect(document.components.schemas).toHaveProperty("ErrorResponse");
    const health = z
      .object({
        properties: z.object({
          status: z.object({
            const: z.literal("ok").optional(),
            enum: z.tuple([z.literal("ok")]).optional(),
          }),
        }),
        required: z.array(z.string()),
        type: z.literal("object"),
      })
      .parse(document.components.schemas.HealthResponse);
    const { status } = health.properties;

    // Literal tunggal boleh `const` atau `enum` satu nilai; keduanya hanya "ok".
    expect(status.const ?? status.enum?.[0]).toBe("ok");
    expect(health.required).toContain("status");
  });

  it("/health merujuk komponen lewat $ref, bukan skema inline", () => {
    expect(jsonSchemaRef(document, "/health", "get", "200")).toStrictEqual({
      $ref: "#/components/schemas/HealthResponse",
    });
    expect(jsonSchemaRef(document, "/health", "get", "500")).toStrictEqual({
      $ref: "#/components/schemas/ErrorResponse",
    });
  });

  it("setiap operasi punya tags, summary, dan respons", () => {
    const operations = Object.values(document.paths).flatMap((methods) =>
      Object.values(methods)
    );

    expect(operations.length).toBeGreaterThan(0);
    for (const operation of operations) {
      expect(Object.keys(operation.responses).length).toBeGreaterThan(0);
    }
  });

  it("tidak mendokumentasikan route dokumentasi itu sendiri", () => {
    expect(document.paths).not.toHaveProperty("/docs");
    expect(document.paths).not.toHaveProperty("/openapi.json");
  });
});

describe("GET /docs (Scalar)", () => {
  it("200 HTML yang memuat dokumen /openapi.json", async () => {
    const response = await fetchWorker("/docs");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^text\/html/u);
    await expect(response.text()).resolves.toContain("/openapi.json");
  });

  it("CSP script-src memakai nonce per request tanpa 'unsafe-inline' atau 'unsafe-eval'", async () => {
    const response = await fetchWorker("/docs");
    const csp = response.headers.get("content-security-policy") ?? "";
    const scriptSrc =
      csp
        .split(";")
        .map((directive) => directive.trim())
        .find((directive) => directive.startsWith("script-src")) ?? "";

    expect(scriptSrc).toMatch(NONCE_IN_CSP);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("script di HTML membawa nonce yang sama dengan CSP", async () => {
    const response = await fetchWorker("/docs");
    const nonce = nonceOf(response);

    expect(nonce).toBeDefined();
    await expect(response.text()).resolves.toContain(`nonce="${nonce}"`);
  });

  it("nonce berbeda di setiap request", async () => {
    const [first, second] = await Promise.all([
      fetchWorker("/docs"),
      fetchWorker("/docs"),
    ]);

    expect(nonceOf(first)).toBeDefined();
    expect(nonceOf(first)).not.toBe(nonceOf(second));
  });
});

describe("guard dokumentasi per lingkungan", () => {
  it.each([
    ["production", "false", "/openapi.json"],
    ["production", "false", "/docs"],
    ["staging", "false", "/openapi.json"],
    ["staging", "false", "/docs"],
  ])(
    "APP_ENV=%s, API_DOCS_ENABLED=%s: %s 404 ErrorResponse",
    async (appEnv, enabled, path) => {
      const env = { ...BASE_ENV, API_DOCS_ENABLED: enabled, APP_ENV: appEnv };
      const response = await requestWithEnv(path, env);

      expect(response.status).toBe(404);

      const body: unknown = await response.json();

      expect(errorResponseSchema.safeParse(body).success).toBeTruthy();
      expect(body).toMatchObject({ error: { code: "NOT_FOUND" } });
    }
  );

  it.each([
    ["development", "false", "/openapi.json"],
    ["development", "false", "/docs"],
    ["staging", "true", "/openapi.json"],
    ["staging", "true", "/docs"],
    ["production", "true", "/openapi.json"],
    ["production", "true", "/docs"],
  ])(
    "APP_ENV=%s, API_DOCS_ENABLED=%s: %s 200",
    async (appEnv, enabled, path) => {
      const env = { ...BASE_ENV, API_DOCS_ENABLED: enabled, APP_ENV: appEnv };
      const response = await requestWithEnv(path, env);

      expect(response.status).toBe(200);
    }
  );

  it("/health tetap 200 di production meski dokumentasi nonaktif", async () => {
    const response = await requestWithEnv("/health", {
      ...BASE_ENV,
      APP_ENV: "production",
    });

    expect(response.status).toBe(200);
  });
});
