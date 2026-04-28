import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

function readPositiveInt(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
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
    query_timeout: readPositiveInt("DATABASE_QUERY_TIMEOUT_MS", 20_000),
    statement_timeout: readPositiveInt("DATABASE_STATEMENT_TIMEOUT_MS", 20_000),
  });

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
