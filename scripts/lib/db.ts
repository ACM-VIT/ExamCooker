import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { QueryResultRow } from "pg";
import { loadScriptEnv } from "./env";

export type Queryable = Pick<Pool, "query">;

function readPositiveInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createPool(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: readPositiveInt("DATABASE_POOL_MAX", 10),
    connectionTimeoutMillis: readPositiveInt(
      "DATABASE_CONNECTION_TIMEOUT_MS",
      10_000,
    ),
    idleTimeoutMillis: readPositiveInt("DATABASE_IDLE_TIMEOUT_MS", 10_000),
    query_timeout: readPositiveInt("DATABASE_QUERY_TIMEOUT_MS", 60_000),
    statement_timeout: readPositiveInt("DATABASE_STATEMENT_TIMEOUT_MS", 60_000),
  });

  pool.on("error", (error) => {
    console.error("[scripts/db] pg pool error", error);
  });

  return pool;
}

export function requireConnectionString(
  connectionString?: string | null,
  envName = "DATABASE_URL",
) {
  loadScriptEnv();

  const value = connectionString?.trim() || process.env[envName]?.trim();
  if (!value) {
    throw new Error(`${envName} is not set.`);
  }

  return value;
}

function createTypedScriptDb(pool: Pool) {
  return drizzle({
    client: pool,
    logger: process.env.NODE_ENV === "development",
  });
}

export type ScriptDatabase = ReturnType<typeof createTypedScriptDb>;

export function createScriptDb(connectionString?: string | null) {
  const url = requireConnectionString(connectionString);
  const pool = createPool(url);
  const db = createTypedScriptDb(pool);

  return {
    db,
    pool,
    async close() {
      await pool.end();
    },
  };
}

export async function queryRows<T extends QueryResultRow = QueryResultRow>(
  queryable: Queryable,
  sqlText: string,
  params: unknown[] = [],
) {
  const result = await queryable.query<T>(sqlText, params);
  return result.rows;
}

export * as schema from "../../db/schema";
