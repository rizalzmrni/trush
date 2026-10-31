import {
  configureSync,
  resetSync,
  getJsonLinesFormatter,
  withContext,
} from "@logtape/logtape";
import type {
  ContextLocalStorage,
  LogLevel,
  LogRecord,
  Sink,
} from "@logtape/logtape";
import {
  CREDIT_CARD_NUMBER_PATTERN,
  DEFAULT_REDACT_FIELDS,
  EMAIL_ADDRESS_PATTERN,
  JWT_PATTERN,
  redactByField,
  redactByPattern,
} from "@logtape/redaction";
import type { FieldPatterns, RedactionPatterns } from "@logtape/redaction";

export { getLogger } from "@logtape/logtape";
export type { LogLevel, Logger } from "@logtape/logtape";

/**
 * Satu-satunya daftar redaksi trush. `fields` mencocokkan nama properti
 * (termasuk bersarang); `patterns` menyaring nilai di baris JSON akhir.
 * Bawaan LogTape sudah memuat password, secret, token, key, auth, email,
 * phone, dan address.
 */
export const REDACTION: {
  readonly fields: FieldPatterns;
  readonly patterns: RedactionPatterns;
} = {
  fields: [...DEFAULT_REDACT_FIELDS, /cookie/iu, /card/iu],
  patterns: [EMAIL_ADDRESS_PATTERN, CREDIT_CARD_NUMBER_PATTERN, JWT_PATTERN],
};

const formatLine = (() => {
  const format = redactByPattern(
    getJsonLinesFormatter({ properties: "flatten" }),
    REDACTION.patterns
  );
  return (record: LogRecord): string => format(record).trimEnd();
})();

const CONSOLE_METHODS = {
  debug: "debug",
  error: "error",
  fatal: "error",
  info: "info",
  trace: "debug",
  warning: "warn",
} as const satisfies Record<LogLevel, keyof Console>;

/** Satu baris JSON per log agar Workers Logs mengindeks field-nya. */
const consoleSink: Sink = (record) => {
  console[CONSOLE_METHODS[record.level]](formatLine(record));
};

/** Batas buffer per isolate; log tertua dibuang bila flush tidak terjadi. */
const MAX_PENDING_LINES = 1000;
const pendingLines: string[] = [];

const betterStackSink: Sink = (record) => {
  if (pendingLines.length >= MAX_PENDING_LINES) {
    pendingLines.shift();
  }
  pendingLines.push(formatLine(record));
};

export interface BetterStackOptions {
  /** URL ingest source, mis. `https://s123.eu-nbg-2.betterstackdata.com`. */
  ingestUrl: string;
  sourceToken: string;
}

let betterStack: BetterStackOptions | undefined;

const reportSinkFailure = (message: string): void => {
  console.error(
    JSON.stringify({
      "@timestamp": new Date().toISOString(),
      level: "ERROR",
      logger: "trush.observability",
      message,
    })
  );
};

/** BetterStack membaca waktu dari `dt`; tanpa itu dipakai waktu terima. */
const toBetterStackEvent = (line: string): Record<string, unknown> => {
  const event = JSON.parse(line) as Record<string, unknown>;
  return { dt: event["@timestamp"], ...event };
};

/**
 * Mengirim log yang tertunda ke BetterStack dalam satu batch. Tidak pernah
 * melempar error: kegagalan hanya dicatat ke console. Panggil lewat
 * `ctx.waitUntil()` (sudah dilakukan `withRequestLogging`).
 */
export const flushLogs = async (): Promise<void> => {
  if (!betterStack || pendingLines.length === 0) {
    return;
  }
  const lines = pendingLines.splice(0);
  try {
    const response = await fetch(betterStack.ingestUrl, {
      body: JSON.stringify(lines.map(toBetterStackEvent)),
      headers: {
        authorization: `Bearer ${betterStack.sourceToken}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
    if (!response.ok) {
      reportSinkFailure(
        `BetterStack menolak ${lines.length} log (HTTP ${response.status}).`
      );
    }
  } catch {
    reportSinkFailure(`${lines.length} log gagal dikirim ke BetterStack.`);
  }
};

export interface LoggerOptions {
  appEnv: "development" | "staging" | "production";
  /** Dari `LOG_LEVEL`. */
  level: LogLevel;
  /** `new AsyncLocalStorage()` dari `node:async_hooks`, dibuat pemanggil. */
  contextLocalStorage: ContextLocalStorage<Record<string, unknown>>;
  /** Tanpa nilai: hanya console (development). */
  betterStack?: BetterStackOptions | undefined;
}

const PRODUCTION_FORBIDDEN_LEVELS: ReadonlySet<LogLevel> = new Set([
  "trace",
  "debug",
]);

let configured = false;

/**
 * Mengonfigurasi LogTape sekali per isolate. Aman dipanggil di setiap
 * request; panggilan setelah yang pertama diabaikan.
 */
export const configureLogger = (options: LoggerOptions): void => {
  if (configured) {
    return;
  }
  if (
    options.appEnv === "production" &&
    PRODUCTION_FORBIDDEN_LEVELS.has(options.level)
  ) {
    throw new Error(
      `LOG_LEVEL=${options.level} tidak diizinkan saat APP_ENV=production.`
    );
  }
  ({ betterStack } = options);
  const sinks: ("console" | "betterStack")[] = betterStack
    ? ["console", "betterStack"]
    : ["console"];
  configureSync({
    contextLocalStorage: options.contextLocalStorage,
    loggers: [
      { category: ["trush"], lowestLevel: options.level, sinks },
      {
        category: ["logtape", "meta"],
        lowestLevel: "warning",
        sinks: ["console"],
      },
    ],
    sinks: {
      betterStack: redactByField(betterStackSink, REDACTION.fields),
      console: redactByField(consoleSink, REDACTION.fields),
    },
  });
  configured = true;
};

interface RequestLike {
  readonly headers: { readonly get: (name: string) => string | null };
}

interface WaitUntilContext {
  readonly waitUntil: (promise: Promise<unknown>) => void;
}

/** `cf-ray` bila ada (request lewat edge Cloudflare), selain itu UUID baru. */
export const getRequestId = (request: RequestLike): string =>
  request.headers.get("cf-ray") ?? crypto.randomUUID();

/**
 * Menjalankan handler dengan `requestId` sebagai konteks setiap log, lalu
 * menjadwalkan flush BetterStack lewat `ctx.waitUntil` tanpa menahan respons.
 * `requestId` boleh diberikan pemanggil (mis. agar sama dengan header
 * respons); tanpa itu diambil dari `getRequestId(request)`.
 */
export const withRequestLogging = async <T>(
  request: RequestLike,
  ctx: WaitUntilContext,
  handler: () => Promise<T>,
  requestId: string = getRequestId(request)
): Promise<T> => {
  try {
    return await withContext({ requestId }, handler);
  } finally {
    ctx.waitUntil(flushLogs());
  }
};

/** Khusus test: mengembalikan guard dan buffer ke keadaan awal. */
export const resetLoggerForTesting = (): void => {
  resetSync();
  configured = false;
  betterStack = undefined;
  pendingLines.length = 0;
};
