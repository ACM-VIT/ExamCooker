import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

function readPositiveInt(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
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

  const message = candidate.message.toLowerCase();
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
  const maxRetries = readPositiveInt("DATABASE_QUERY_RETRIES", 2);
  const retryDelayMs = readPositiveInt("DATABASE_QUERY_RETRY_DELAY_MS", 250);
  const rawQuery = pool.query.bind(pool) as (...args: unknown[]) => unknown;

  pool.query = ((...args: unknown[]) => {
    if (typeof args.at(-1) === "function" || !isRetrySafeQuery(args)) {
      return rawQuery(...args);
    }

    return (async () => {
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await rawQuery(...args);
        } catch (error) {
          if (attempt >= maxRetries || !isTransientDbError(error)) {
            throw error;
          }

          console.warn(
            `[db] transient query failure, retrying ${attempt + 1}/${maxRetries}`,
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

  const pool = new Pool({
    connectionString,
    max: readPositiveInt("DATABASE_POOL_MAX", 5),
    connectionTimeoutMillis: readPositiveInt(
      "DATABASE_CONNECTION_TIMEOUT_MS",
      10_000,
    ),
    idleTimeoutMillis: readPositiveInt("DATABASE_IDLE_TIMEOUT_MS", 30_000),
    keepAlive: true,
    keepAliveInitialDelayMillis: readPositiveInt(
      "DATABASE_KEEPALIVE_INITIAL_DELAY_MS",
      10_000,
    ),
    query_timeout: readPositiveInt("DATABASE_QUERY_TIMEOUT_MS", 20_000),
    statement_timeout: readPositiveInt("DATABASE_STATEMENT_TIMEOUT_MS", 20_000),
  });

  attachQueryRetry(pool);

  pool.on("error", (error) => {
    console.error("[db] pg pool error", error);
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
