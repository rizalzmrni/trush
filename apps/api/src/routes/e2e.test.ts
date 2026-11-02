import { e2eOutboxResponseSchema } from "@trush/core/schemas/e2e";
import { errorResponseSchema } from "@trush/core/schemas/error";
import { defaultEmailOutbox } from "@trush/email";
import { createApiEnv } from "@trush/env/api";
import { defaultOutbox } from "@trush/phone";
import { Hono } from "hono";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { AppContext } from "../context";
import { onError } from "../middleware/error";
import { envForAppEnv, requestWithEnv } from "../testing/request";
import { E2E_OUTBOX_PATH, e2eGuard } from "./e2e";

const WARMUP_TIMEOUT_MS = 30_000;
const FIRST = "+6281200000001";
const SECOND = "+6281200000002";

/** Development + `E2E=true` + driver telepon/email `memory` (semua nilai palsu). */
const E2E_ENV = { ...envForAppEnv("development"), E2E: "true" };

const outboxRequest = (
  env: Record<string, string>,
  { method = "GET", to }: { method?: "DELETE" | "GET"; to?: string } = {}
) =>
  requestWithEnv(
    to === undefined
      ? E2E_OUTBOX_PATH
      : `${E2E_OUTBOX_PATH}?${new URLSearchParams({ to })}`,
    env,
    { method }
  );

/** Ringkasan respons untuk dibandingkan dengan `NOT_FOUND`. */
const errorShape = async (response: Response) => {
  const body: unknown = await response.json();
  return {
    code: errorResponseSchema.safeParse(body).data?.error.code,
    status: response.status,
  };
};

const NOT_FOUND = { code: "NOT_FOUND", status: 404 };

/** Isi outbox bersama (driver `memory`) dengan urutan kirim yang diketahui. */
const seedOutbox = () => {
  defaultOutbox.add({ channel: "whatsapp", code: "111111", to: FIRST });
  defaultOutbox.add({ channel: "sms", code: "222222", to: SECOND });
  defaultOutbox.add({ channel: "whatsapp", code: "333333", to: FIRST });
};

const codesOf = async (response: Response): Promise<(string | null)[]> => {
  const body = e2eOutboxResponseSchema.parse(await response.json());
  return body.messages.map((message) => message.code);
};

describe("/__e2e/outbox", () => {
  beforeAll(async () => {
    // Pemanasan: request pertama di workerd lambat (transformasi modul Vite).
    await outboxRequest(E2E_ENV);
  }, WARMUP_TIMEOUT_MS);

  afterEach(() => {
    defaultOutbox.clear();
  });

  it.each(["GET", "DELETE"] as const)(
    "%s 404 ErrorResponse bila E2E=false (development)",
    async (method) => {
      seedOutbox();

      await expect(
        errorShape(
          await outboxRequest(
            { ...envForAppEnv("development"), E2E: "false" },
            { method }
          )
        )
      ).resolves.toStrictEqual(NOT_FOUND);
      expect(defaultOutbox.list()).toHaveLength(3);
    }
  );

  it.each(["GET", "DELETE"] as const)(
    "%s 404 bila E2E tidak diset",
    async (method) => {
      await expect(
        errorShape(await outboxRequest(envForAppEnv("development"), { method }))
      ).resolves.toStrictEqual(NOT_FOUND);
    }
  );

  it.each(["staging", "production"])(
    "APP_ENV=%s tanpa E2E → 404",
    async (appEnv) => {
      await expect(
        errorShape(await outboxRequest(envForAppEnv(appEnv)))
      ).resolves.toStrictEqual(NOT_FOUND);
    }
  );

  it.each(["staging", "production"])(
    "APP_ENV=%s dengan E2E=true → env ditolak (500 generik), outbox tidak terbuka",
    async (appEnv) => {
      seedOutbox();

      const response = await outboxRequest({
        ...envForAppEnv(appEnv),
        E2E: "true",
      });
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(
        errorResponseSchema.safeParse(JSON.parse(text)).success
      ).toBeTruthy();
      expect(text).not.toContain("111111");
      expect(text).not.toContain(FIRST);
    }
  );

  it("GET 200 sesuai kontrak, terbaru dulu", async () => {
    seedOutbox();

    const response = await outboxRequest(E2E_ENV);

    expect(response.status).toBe(200);
    const body = e2eOutboxResponseSchema.parse(await response.json());
    expect(body.messages.map(({ code, to }) => ({ code, to }))).toStrictEqual([
      { code: "333333", to: FIRST },
      { code: "222222", to: SECOND },
      { code: "111111", to: FIRST },
    ]);
    expect(body.messages[1]?.channel).toBe("sms");
    expect(new Set(body.messages.map(({ id }) => id)).size).toBe(3);
    expect(body.messages[0]?.body).toContain("333333");
  });

  it("GET kosong → messages []", async () => {
    const response = await outboxRequest(E2E_ENV);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ messages: [] });
  });

  it("GET ?to= menyaring tujuan persis", async () => {
    seedOutbox();

    const response = await outboxRequest(E2E_ENV, { to: FIRST });

    await expect(codesOf(response)).resolves.toStrictEqual([
      "333333",
      "111111",
    ]);
  });

  it("GET ?to= nomor lain → kosong (tanpa pencocokan sebagian)", async () => {
    seedOutbox();

    const response = await outboxRequest(E2E_ENV, { to: "+62812000000" });

    await expect(codesOf(response)).resolves.toStrictEqual([]);
  });

  it("DELETE ?to= 204 hanya menghapus nomor itu", async () => {
    seedOutbox();

    const deleted = await outboxRequest(E2E_ENV, {
      method: "DELETE",
      to: FIRST,
    });
    const remaining = await outboxRequest(E2E_ENV);

    expect(deleted.status).toBe(204);
    await expect(deleted.text()).resolves.toBe("");
    await expect(codesOf(remaining)).resolves.toStrictEqual(["222222"]);
  });

  it("DELETE tanpa to → 204 mengosongkan semua", async () => {
    seedOutbox();

    const deleted = await outboxRequest(E2E_ENV, { method: "DELETE" });

    expect(deleted.status).toBe(204);
    expect(defaultOutbox.list()).toStrictEqual([]);
  });

  it("tidak tercantum di /openapi.json", async () => {
    const response = await requestWithEnv("/openapi.json", E2E_ENV);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("__e2e");
    expect(text).not.toContain("E2eOutbox");
  });
});

const EMAIL = "budi@example.test";

/** Email palsu ke outbox email bersama; `at` mengatur waktu kirim. */
const seedEmail = (to: string, code: string | null, at: string) => {
  vi.setSystemTime(new Date(at));
  defaultEmailOutbox.add({
    code,
    html: "<p>palsu</p>",
    idempotencyKey: `uji/${at}`,
    subject:
      code === null
        ? "Atur ulang kata sandi trush"
        : "Kode verifikasi email trush",
    template: code === null ? "password-reset" : "verification-otp",
    text:
      code === null
        ? "Tautan: http://localhost:8787/api/auth/reset-password/tok"
        : `Kode ${code}`,
    to,
  });
};

const seedPhone = (to: string, code: string, at: string) => {
  vi.setSystemTime(new Date(at));
  defaultOutbox.add({ channel: "whatsapp", code, to });
};

/** Telepon dan email berselang-seling dengan waktu kirim yang diketahui. */
const seedMixed = () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  seedPhone(FIRST, "111111", "2026-11-02T01:00:00.000Z");
  seedEmail(EMAIL, "222222", "2026-11-02T02:00:00.000Z");
  seedPhone(FIRST, "333333", "2026-11-02T03:00:00.000Z");
  seedEmail("ani@example.test", null, "2026-11-02T04:00:00.000Z");
  vi.useRealTimers();
};
describe("/__e2e/outbox email (B17)", () => {
  beforeAll(async () => {
    await outboxRequest(E2E_ENV);
  }, WARMUP_TIMEOUT_MS);

  afterEach(() => {
    vi.useRealTimers();
    defaultOutbox.clear();
    defaultEmailOutbox.clear();
  });

  it("GET menggabung telepon + email sesuai kontrak, terbaru dulu", async () => {
    seedMixed();

    const response = await outboxRequest(E2E_ENV);
    const body = e2eOutboxResponseSchema.parse(await response.json());

    expect(
      body.messages.map(({ channel, code, subject, to }) => ({
        channel,
        code,
        subject,
        to,
      }))
    ).toStrictEqual([
      {
        channel: "email",
        code: null,
        subject: "Atur ulang kata sandi trush",
        to: "ani@example.test",
      },
      { channel: "whatsapp", code: "333333", subject: null, to: FIRST },
      {
        channel: "email",
        code: "222222",
        subject: "Kode verifikasi email trush",
        to: EMAIL,
      },
      { channel: "whatsapp", code: "111111", subject: null, to: FIRST },
    ]);
    expect(body.messages[0]?.body).toContain("/reset-password/tok");
    expect(body.messages[2]?.createdAt).toBe("2026-11-02T02:00:00.000Z");
  });

  it("GET ?to= email tanpa beda huruf besar/kecil, hanya pesan alamat itu", async () => {
    seedMixed();

    const response = await outboxRequest(E2E_ENV, {
      to: "  BUDI@Example.TEST ",
    });

    await expect(codesOf(response)).resolves.toStrictEqual(["222222"]);
  });

  it("GET ?to= alamat lain → kosong (tanpa pencocokan sebagian)", async () => {
    seedMixed();

    const response = await outboxRequest(E2E_ENV, { to: "udi@example.test" });

    await expect(codesOf(response)).resolves.toStrictEqual([]);
  });

  it("DELETE ?to= email (beda huruf) 204 hanya menghapus email alamat itu", async () => {
    seedMixed();

    const deleted = await outboxRequest(E2E_ENV, {
      method: "DELETE",
      to: "Budi@EXAMPLE.test",
    });
    const remaining = await outboxRequest(E2E_ENV);

    expect(deleted.status).toBe(204);
    await expect(codesOf(remaining)).resolves.toStrictEqual([
      null,
      "333333",
      "111111",
    ]);
  });

  it("DELETE ?to= nomor tidak menyentuh email", async () => {
    seedMixed();

    await outboxRequest(E2E_ENV, { method: "DELETE", to: FIRST });

    expect(defaultOutbox.list()).toStrictEqual([]);
    expect(defaultEmailOutbox.list()).toHaveLength(2);
  });

  it("DELETE tanpa to → 204 mengosongkan telepon dan email", async () => {
    seedMixed();

    const deleted = await outboxRequest(E2E_ENV, { method: "DELETE" });

    expect(deleted.status).toBe(204);
    expect(defaultOutbox.list()).toStrictEqual([]);
    expect(defaultEmailOutbox.list()).toStrictEqual([]);
  });

  it("E2E=false: email di outbox tidak terbaca (404)", async () => {
    seedMixed();

    const response = await outboxRequest({
      ...envForAppEnv("development"),
      E2E: "false",
    });
    const text = await response.text();

    expect(response.status).toBe(404);
    expect(text).not.toContain("222222");
    expect(text).not.toContain(EMAIL);
  });
});

/**
 * Lapisan kedua: walau env lolos dengan `E2E=true` di luar development
 * (mis. aturan factory berubah), guard tetap 404.
 */
const guardedApp = (appEnv: "development" | "production" | "staging") => {
  const env = {
    ...createApiEnv({ runtimeEnv: E2E_ENV }),
    APP_ENV: appEnv,
  };
  const app = new Hono<AppContext>();
  app.onError(onError);
  app.use("*", (c, next) => {
    c.set("env", env);
    return next();
  });
  app.get("*", e2eGuard, (c) => c.text("terbuka"));
  return app;
};

describe(e2eGuard, () => {
  it.each(["staging", "production"] as const)(
    "E2E=true tetapi APP_ENV=%s → 404",
    async (appEnv) => {
      await expect(
        errorShape(
          await guardedApp(appEnv).request(`http://localhost${E2E_OUTBOX_PATH}`)
        )
      ).resolves.toStrictEqual(NOT_FOUND);
    }
  );

  it("E2E=true + development → diteruskan ke handler", async () => {
    const response = await guardedApp("development").request(
      `http://localhost${E2E_OUTBOX_PATH}`
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("terbuka");
  });
});
