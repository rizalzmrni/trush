import { AsyncLocalStorage } from "node:async_hooks";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  configureLogger,
  flushLogs,
  getLogger,
  getRequestId,
  resetLoggerForTesting,
  withRequestLogging,
} from "./logger";
import type { LoggerOptions } from "./logger";

// Nilai palsu; tidak pernah dikirim ke jaringan nyata.
const FAKE_TOKEN = "fake-source-token-123";
const FAKE_INGEST_URL = "https://ingest.example.test";
const FAKE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
const FAKE_CARD = "4111 1111 1111 1111";
const FAKE_EMAIL = "budi@example.test";
const MAX_PENDING_LINES = 1000;

const logger = getLogger(["trush", "test"]);

const logOnce = (): Promise<void> => {
  logger.info("x");
  return Promise.resolve();
};

const baseOptions = (
  overrides: Partial<LoggerOptions> = {}
): LoggerOptions => ({
  appEnv: "development",
  contextLocalStorage: new AsyncLocalStorage(),
  level: "info",
  ...overrides,
});

const withBetterStack = (overrides: Partial<LoggerOptions> = {}) =>
  baseOptions({
    betterStack: { ingestUrl: FAKE_INGEST_URL, sourceToken: FAKE_TOKEN },
    ...overrides,
  });

const consoleSpies = () => ({
  debug: vi.spyOn(console, "debug").mockReturnValue(undefined),
  error: vi.spyOn(console, "error").mockReturnValue(undefined),
  info: vi.spyOn(console, "info").mockReturnValue(undefined),
  warn: vi.spyOn(console, "warn").mockReturnValue(undefined),
});

type Spies = ReturnType<typeof consoleSpies>;

/** Semua baris yang dicetak sink console, sudah di-parse dari JSON. */
const printedLines = (spies: Spies): string[] =>
  [spies.debug, spies.info, spies.warn, spies.error].flatMap((spy) =>
    spy.mock.calls.map((call) => String(call[0]))
  );

const printedRecords = (spies: Spies): Record<string, unknown>[] =>
  printedLines(spies).map(
    (line) => JSON.parse(line) as Record<string, unknown>
  );

const mockFetch = (response: Response | Error = new Response(null)) => {
  const fetchMock = vi.fn<typeof fetch>(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response)
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const sentEvents = (
  fetchMock: ReturnType<typeof mockFetch>
): Record<string, unknown>[] => {
  const init = fetchMock.mock.calls[0]?.[1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>[];
};

const request = (headers: Record<string, string> = {}) =>
  new Request("https://api.example.test/", { headers });

describe("logger trush", () => {
  let spies: Spies;

  beforeEach(() => {
    resetLoggerForTesting();
    spies = consoleSpies();
  });

  afterEach(() => {
    resetLoggerForTesting();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("satu baris JSON per log dengan level, pesan, dan properti", () => {
    configureLogger(baseOptions());

    logger.info("proyek dibuat {projectId}", { projectId: "p_1" });

    const lines = printedLines(spies);

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("\n");
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      level: "INFO",
      message: 'proyek dibuat "p_1"',
      projectId: "p_1",
    });
  });

  it("level dipetakan ke method console yang sesuai", () => {
    configureLogger(baseOptions({ level: "trace" }));

    logger.debug("d");
    logger.warn("w");
    logger.error("e");

    expect(spies.debug).toHaveBeenCalledOnce();
    expect(spies.warn).toHaveBeenCalledOnce();
    expect(spies.error).toHaveBeenCalledOnce();
  });

  it("level di bawah ambang tersaring", () => {
    configureLogger(baseOptions({ level: "warning" }));

    logger.debug("tidak tampil");
    logger.info("tidak tampil");
    logger.warn("tampil");

    expect(printedRecords(spies)).toStrictEqual([
      expect.objectContaining({ message: "tampil" }),
    ]);
  });

  it("redaksi berdasarkan field, termasuk bersarang", () => {
    configureLogger(baseOptions());

    logger.info("login", {
      user: {
        authorization: "Bearer abc",
        cookie: "session=abc",
        credentials: { password: "hunter2" },
        id: "u_1",
        payment: { cardNumber: "4111" },
        sessionToken: "tok",
      },
      email: FAKE_EMAIL,
      secret: "s",
    });

    const [line] = printedLines(spies);
    const record = JSON.parse(line ?? "") as Record<string, unknown>;

    for (const value of [
      "Bearer abc",
      "session=abc",
      "hunter2",
      "tok",
      "4111",
    ]) {
      expect(line).not.toContain(value);
    }
    expect(line).not.toContain(FAKE_EMAIL);
    expect(record).not.toHaveProperty("secret");
    expect(record).not.toHaveProperty("email");
    expect(record["user"]).toStrictEqual({ id: "u_1", payment: {} });
  });

  it("redaksi pola di string: email, nomor kartu, JWT", () => {
    configureLogger(baseOptions());

    logger.info("catatan {note}", {
      note: `kontak ${FAKE_EMAIL}, kartu ${FAKE_CARD}, jwt ${FAKE_JWT}`,
    });

    const [line] = printedLines(spies);

    expect(line).not.toContain(FAKE_EMAIL);
    expect(line).not.toContain(FAKE_CARD);
    expect(line).not.toContain(FAKE_JWT);
    expect(line).toContain("kontak");
  });

  it("konfigurasi kedua diabaikan", () => {
    configureLogger(baseOptions({ level: "error" }));

    expect(() =>
      configureLogger(baseOptions({ level: "debug" }))
    ).not.toThrow();

    logger.info("tersaring oleh konfigurasi pertama");

    expect(printedLines(spies)).toHaveLength(0);
  });

  it.each(["trace", "debug"] as const)(
    "LOG_LEVEL %s ditolak saat APP_ENV=production",
    (level) => {
      expect(() =>
        configureLogger(baseOptions({ appEnv: "production", level }))
      ).toThrow(/production/u);
    }
  );

  it.each(["info", "warning", "error", "fatal"] as const)(
    "LOG_LEVEL %s diizinkan saat APP_ENV=production",
    (level) => {
      expect(() =>
        configureLogger(baseOptions({ appEnv: "production", level }))
      ).not.toThrow();
    }
  );

  it.each(["staging", "development"] as const)(
    "LOG_LEVEL debug diizinkan saat APP_ENV=%s",
    (appEnv) => {
      expect(() =>
        configureLogger(baseOptions({ appEnv, level: "debug" }))
      ).not.toThrow();
    }
  );
});

describe("konteks request", () => {
  let spies: Spies;

  beforeEach(() => {
    resetLoggerForTesting();
    spies = consoleSpies();
  });

  afterEach(() => {
    resetLoggerForTesting();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("requestId dari cf-ray ada di top level setiap log", async () => {
    configureLogger(baseOptions());
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();

    await withRequestLogging(
      request({ "cf-ray": "8abc-SIN" }),
      { waitUntil },
      () => {
        logger.info("satu");
        logger.warn("dua");
        return Promise.resolve();
      }
    );

    const records = printedRecords(spies);

    expect(records).toHaveLength(2);
    for (const record of records) {
      expect(record).toHaveProperty("requestId", "8abc-SIN");
    }
  });

  it("tanpa cf-ray requestId berupa UUID baru per request", async () => {
    configureLogger(baseOptions());
    const ctx = { waitUntil: vi.fn<(promise: Promise<unknown>) => void>() };

    await withRequestLogging(request(), ctx, logOnce);
    await withRequestLogging(request(), ctx, logOnce);

    const [first, second] = printedRecords(spies).map(
      (record) => record["requestId"]
    );

    expect(first).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u
    );
    expect(second).not.toBe(first);
  });

  it("log di luar request tidak membawa requestId", async () => {
    configureLogger(baseOptions());
    await withRequestLogging(
      request({ "cf-ray": "r1" }),
      { waitUntil: vi.fn<(promise: Promise<unknown>) => void>() },
      () => Promise.resolve()
    );

    logger.info("di luar");

    expect(printedRecords(spies)[0]).not.toHaveProperty("requestId");
  });

  it("mengembalikan hasil handler dan menjadwalkan flush lewat waitUntil", async () => {
    configureLogger(baseOptions());
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();

    const result = await withRequestLogging(request(), { waitUntil }, () =>
      Promise.resolve("ok")
    );

    expect(result).toBe("ok");
    expect(waitUntil).toHaveBeenCalledOnce();
    expect(waitUntil.mock.calls[0]?.[0]).toBeInstanceOf(Promise);
  });

  it("handler gagal: error diteruskan dan waitUntil tetap dipanggil", async () => {
    configureLogger(baseOptions());
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();

    await expect(
      withRequestLogging(request(), { waitUntil }, () =>
        Promise.reject(new Error("gagal"))
      )
    ).rejects.toThrow("gagal");
    expect(waitUntil).toHaveBeenCalledOnce();
  });

  it("getRequestId memakai cf-ray bila ada", () => {
    expect(getRequestId(request({ "cf-ray": "abc" }))).toBe("abc");
  });
});

describe("sink BetterStack", () => {
  let spies: Spies;

  beforeEach(() => {
    resetLoggerForTesting();
    spies = consoleSpies();
  });

  afterEach(() => {
    resetLoggerForTesting();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("mengirim satu POST ke ingest URL dengan header Bearer", async () => {
    const fetchMock = mockFetch();
    configureLogger(withBetterStack());

    logger.info("satu");
    logger.info("dua");
    await flushLogs();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);

    expect(url).toBe(FAKE_INGEST_URL);
    expect(init?.method).toBe("POST");
    expect(headers.get("authorization")).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("batch berupa array JSON yang setiap event memiliki dt dan teredaksi", async () => {
    const fetchMock = mockFetch();
    configureLogger(withBetterStack());

    logger.info("satu");
    logger.info("dua {email}", { email: FAKE_EMAIL });
    await flushLogs();

    const init = fetchMock.mock.calls[0]?.[1];
    const events = sentEvents(fetchMock);

    expect(events).toHaveLength(2);
    for (const event of events) {
      expect(event["dt"]).toBe(event["@timestamp"]);
      expect(event["dt"]).toBeTypeOf("string");
    }
    expect(String(init?.body)).not.toContain(FAKE_EMAIL);
  });

  it("flush lewat withRequestLogging membawa requestId", async () => {
    const fetchMock = mockFetch();
    configureLogger(withBetterStack());
    const pending: Promise<unknown>[] = [];

    await withRequestLogging(
      request({ "cf-ray": "ray-1" }),
      { waitUntil: (promise) => pending.push(promise) },
      () => {
        logger.info("x");
        return Promise.resolve();
      }
    );
    await Promise.all(pending);

    expect(sentEvents(fetchMock)).toStrictEqual([
      expect.objectContaining({ requestId: "ray-1" }),
    ]);
  });

  it("buffer kosong setelah flush; flush berikutnya tidak mengirim ulang", async () => {
    const fetchMock = mockFetch();
    configureLogger(withBetterStack());

    logger.info("x");
    await flushLogs();
    await flushLogs();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("tanpa konfigurasi BetterStack tidak memanggil fetch", async () => {
    const fetchMock = mockFetch();
    configureLogger(baseOptions());

    logger.info("x");
    await flushLogs();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it(`buffer dibatasi ${MAX_PENDING_LINES} baris, yang tertua dibuang`, async () => {
    const fetchMock = mockFetch();
    configureLogger(withBetterStack());
    const extra = 5;

    for (let index = 0; index < MAX_PENDING_LINES + extra; index += 1) {
      logger.info("baris {index}", { index });
    }
    await flushLogs();

    const events = sentEvents(fetchMock);

    expect(events).toHaveLength(MAX_PENDING_LINES);
    expect(events[0]).toMatchObject({ index: extra });
    expect(events.at(-1)).toMatchObject({
      index: MAX_PENDING_LINES + extra - 1,
    });
  });

  it("fetch gagal tidak melempar dan tidak mencetak token", async () => {
    mockFetch(new Error(`koneksi ditolak ${FAKE_TOKEN}`));
    configureLogger(withBetterStack());

    logger.info("x");

    await expect(flushLogs()).resolves.toBeUndefined();
    expect(spies.error).toHaveBeenCalledOnce();
    expect(printedLines(spies).join("\n")).not.toContain(FAKE_TOKEN);
  });

  it("HTTP non-2xx tidak melempar, dicatat tanpa token", async () => {
    mockFetch(new Response("unauthorized", { status: 401 }));
    configureLogger(withBetterStack());

    logger.info("x");

    await expect(flushLogs()).resolves.toBeUndefined();
    const failure = spies.error.mock.calls.map((call) => String(call[0]));

    expect(failure).toHaveLength(1);
    expect(failure[0]).toContain("401");
    expect(failure[0]).not.toContain(FAKE_TOKEN);
    expect(JSON.parse(failure[0] ?? "")).toMatchObject({ level: "ERROR" });
  });

  it("flush gagal di waitUntil tidak menggagalkan request", async () => {
    mockFetch(new Error("offline"));
    configureLogger(withBetterStack());
    const pending: Promise<unknown>[] = [];

    const result = await withRequestLogging(
      request(),
      { waitUntil: (promise) => pending.push(promise) },
      () => {
        logger.info("x");
        return Promise.resolve("ok");
      }
    );

    expect(result).toBe("ok");
    await expect(Promise.all(pending)).resolves.toBeDefined();
  });
});
