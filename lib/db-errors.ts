type PostgresError = {
  code: string;
  constraint?: unknown;
  message?: unknown;
};

// Drizzle wraps driver errors in DrizzleQueryError, which keeps the Postgres
// error (and its code) only as `cause`.
function findPostgresError(error: unknown): PostgresError | null {
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    if (typeof (current as { code?: unknown }).code === "string") {
      return current as PostgresError;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/** True for a unique violation, optionally of one named constraint. */
export function isUniqueViolation(error: unknown, constraint?: string) {
  const postgresError = findPostgresError(error);
  if (postgresError?.code !== "23505") return false;
  if (!constraint) return true;
  if (postgresError.constraint === constraint) return true;
  return typeof postgresError.message === "string" &&
    postgresError.message.toLowerCase().includes(constraint.toLowerCase());
}
