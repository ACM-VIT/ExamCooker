import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { QueryResultRow } from "pg";
import * as schema from "../../db/schema";
import { loadScriptEnv } from "./env";

export type ScriptDatabase = NodePgDatabase<typeof schema> & {
  $client: Pool;
};
export type Queryable = Pick<Pool, "query">;

function readPositiveInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createPool(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: readPositiveInt("DATABASE_POOL_MAX", 5),
    connectionTimeoutMillis: readPositiveInt(
      "DATABASE_CONNECTION_TIMEOUT_MS",
      10_000,
    ),
    idleTimeoutMillis: readPositiveInt("DATABASE_IDLE_TIMEOUT_MS", 30_000),
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

export function createScriptDb(connectionString?: string | null) {
  const url = requireConnectionString(connectionString);
  const pool = createPool(url);
  const db = drizzle({
    client: pool,
    schema,
    logger: process.env.NODE_ENV === "development",
  }) as ScriptDatabase;

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

export { schema };
