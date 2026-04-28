import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

function readPositiveInt(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readNonNegativeInt(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readOptionalPositiveInt(name: string) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function readBoolean(name: string, fallback = false) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

function readString(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

const TRANSIENT_DB_ERROR_CODES = new Set([
  "08000",
  "08003",
  "08006",
  "57P01",
  "57P02",
  "57P03",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
]);

const TRANSIENT_DB_ERROR_MESSAGES = [
  "connection terminated unexpectedly",
  "query read timeout",
  "read econnreset",
  "read etimedout",
  "socket hang up",
];

type RetryableDbError = Error & {
  code?: string;
  cause?: unknown;
};

type QueryConfigLike = {
  text?: unknown;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getDbErrorCandidate(error: unknown): RetryableDbError | null {
  if (!error || typeof error !== "object") return null;
  return error as RetryableDbError;
}

function describeDbError(error: unknown): string {
  const candidate = getDbErrorCandidate(error);
  if (!candidate) return String(error);

  const parts = [candidate.code, candidate.message].filter(Boolean);
  const cause = getDbErrorCandidate(candidate.cause);
  if (cause?.message) {
    parts.push(`cause=${cause.message}`);
  }
  return parts.join(" | ");
}

function isTransientDbError(error: unknown): boolean {
  const candidate = getDbErrorCandidate(error);
  if (!candidate) return false;

  if (candidate.code && TRANSIENT_DB_ERROR_CODES.has(candidate.code)) {
    return true;
  }

  const message = candidate.message?.toLowerCase() ?? "";
  if (TRANSIENT_DB_ERROR_MESSAGES.some((snippet) => message.includes(snippet))) {
    return true;
  }

  return candidate.cause !== undefined && isTransientDbError(candidate.cause);
}

function getQueryText(args: unknown[]): string | null {
  const [firstArg] = args;

  if (typeof firstArg === "string") {
    return firstArg;
  }

  if (
    firstArg &&
    typeof firstArg === "object" &&
    typeof (firstArg as QueryConfigLike).text === "string"
  ) {
    return (firstArg as { text: string }).text;
  }

  return null;
}

function summarizeQueryText(queryText: string) {
  const normalized = stripLeadingSqlComments(queryText).replace(/\s+/g, " ").trim();
  if (normalized.length <= 240) {
    return normalized;
  }

  return `${normalized.slice(0, 237)}...`;
}

function describePoolState(pool: Pool) {
  return `total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`;
}

function stripLeadingSqlComments(queryText: string) {
  let remaining = queryText.trimStart();

  for (;;) {
    if (remaining.startsWith("--")) {
      const nextLineIndex = remaining.indexOf("\n");
      remaining =
        nextLineIndex === -1 ? "" : remaining.slice(nextLineIndex + 1).trimStart();
      continue;
    }

    if (remaining.startsWith("/*")) {
      const commentEndIndex = remaining.indexOf("*/", 2);
      if (commentEndIndex === -1) {
        return "";
      }

      remaining = remaining.slice(commentEndIndex + 2).trimStart();
      continue;
    }

    return remaining;
  }
}

function isRetrySafeQuery(args: unknown[]) {
  const queryText = getQueryText(args);
  if (!queryText) {
    return false;
  }

  return /^(select|show)\b/i.test(stripLeadingSqlComments(queryText));
}

function attachQueryRetry(pool: Pool) {
  const maxRetries = readNonNegativeInt("DATABASE_QUERY_RETRIES", 2);
  const retryDelayMs = readPositiveInt("DATABASE_QUERY_RETRY_DELAY_MS", 250);
  const slowQueryThresholdMs = readNonNegativeInt("DATABASE_LOG_SLOW_QUERY_MS", 0);
  const logConnectionEvents = readBoolean("DATABASE_LOG_CONNECTION_EVENTS", false);
  const rawQuery = pool.query.bind(pool) as (...args: unknown[]) => unknown;

  if (logConnectionEvents) {
    pool.on("connect", () => {
      console.info(`[db] pool connect (${describePoolState(pool)})`);
    });

    pool.on("remove", () => {
      console.info(`[db] pool remove (${describePoolState(pool)})`);
    });
  }

  pool.query = ((...args: unknown[]) => {
    if (typeof args.at(-1) === "function" || !isRetrySafeQuery(args)) {
      return rawQuery(...args);
    }

    return (async () => {
      const queryText = getQueryText(args);
      const queryLabel = queryText ? summarizeQueryText(queryText) : "unknown query";
      const startedAt = Date.now();

      for (let attempt = 0; ; attempt += 1) {
        try {
          const result = await rawQuery(...args);
          const totalDurationMs = Date.now() - startedAt;

          if (slowQueryThresholdMs > 0 && totalDurationMs >= slowQueryThresholdMs) {
            console.warn(
              `[db] slow query ${totalDurationMs}ms (${describePoolState(pool)}) ${queryLabel}`,
            );
          }

          return result;
        } catch (error) {
          const totalDurationMs = Date.now() - startedAt;

          if (attempt >= maxRetries || !isTransientDbError(error)) {
            console.error(
              `[db] query failure after ${totalDurationMs}ms (${describePoolState(pool)}) ${queryLabel}`,
              describeDbError(error),
            );
            throw error;
          }

          console.warn(
            `[db] transient query failure after ${totalDurationMs}ms, retrying ${attempt + 1}/${maxRetries + 1} (${describePoolState(pool)}) ${queryLabel}`,
            describeDbError(error),
          );
          await sleep(retryDelayMs * (attempt + 1));
        }
      }
    })();
  }) as typeof pool.query;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const applicationName = readString("DATABASE_APPLICATION_NAME", "examcooker-web");
  const poolMin = readNonNegativeInt("DATABASE_POOL_MIN", 0);
  const poolMax = readPositiveInt("DATABASE_POOL_MAX", 5);
  const maxLifetimeSeconds = readOptionalPositiveInt(
    "DATABASE_POOL_MAX_LIFETIME_SECONDS",
  );
  const maxUses = readOptionalPositiveInt("DATABASE_POOL_MAX_USES");
  const connectionTimeoutMillis = readPositiveInt(
    "DATABASE_CONNECTION_TIMEOUT_MS",
    10_000,
  );
  const idleTimeoutMillis = readPositiveInt("DATABASE_IDLE_TIMEOUT_MS", 30_000);
  const keepAliveInitialDelayMillis = readPositiveInt(
    "DATABASE_KEEPALIVE_INITIAL_DELAY_MS",
    5_000,
  );
  const queryTimeoutMillis = readPositiveInt("DATABASE_QUERY_TIMEOUT_MS", 20_000);
  const statementTimeoutMillis = readPositiveInt(
    "DATABASE_STATEMENT_TIMEOUT_MS",
    20_000,
  );

  const pool = new Pool({
    connectionString,
    application_name: applicationName,
    min: poolMin,
    max: poolMax,
    maxLifetimeSeconds,
    maxUses,
    connectionTimeoutMillis,
    idleTimeoutMillis,
    keepAlive: true,
    keepAliveInitialDelayMillis,
    query_timeout: queryTimeoutMillis,
    statement_timeout: statementTimeoutMillis,
  });

  console.info(
    `[db] pool configured app=${applicationName} min=${poolMin} max=${poolMax} connectTimeoutMs=${connectionTimeoutMillis} idleTimeoutMs=${idleTimeoutMillis} keepAliveInitialDelayMs=${keepAliveInitialDelayMillis} queryTimeoutMs=${queryTimeoutMillis} statementTimeoutMs=${statementTimeoutMillis} maxLifetimeSeconds=${maxLifetimeSeconds ?? 0} maxUses=${maxUses ?? 0}`,
  );

  attachQueryRetry(pool);

  pool.on("error", (error) => {
    console.error(`[db] pg pool error (${describePoolState(pool)})`, error);
  });

  return pool;
}

type Database = NodePgDatabase<typeof schema> & { $client: Pool };

declare global {
  // eslint-disable-next-line no-var
  var __examCookerDb: Database | undefined;
  // eslint-disable-next-line no-var
  var __examCookerDbBeforeExitHookRegistered: boolean | undefined;
}

function createDb(): Database {
  const client = createPool();
  return drizzle<typeof schema>({
    client,
    schema,
    logger: process.env.NODE_ENV === "development",
  }) as Database;
}

export function getDb() {
  if (!globalThis.__examCookerDb) {
    globalThis.__examCookerDb = createDb();
  }

  return globalThis.__examCookerDb;
}

if (!globalThis.__examCookerDbBeforeExitHookRegistered) {
  process.on("beforeExit", async () => {
    await globalThis.__examCookerDb?.$client.end();
  });
  globalThis.__examCookerDbBeforeExitHookRegistered = true;
}

export const db = getDb();

export type { Database };
export * from "@/db/schema";
export * from "@/db/enums";
export * from "@/db/types";
