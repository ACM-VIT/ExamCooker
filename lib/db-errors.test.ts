import assert from "node:assert/strict";
import { test } from "node:test";
import { DrizzleQueryError } from "drizzle-orm";
import { isUniqueViolation } from "./db-errors";

const linkConstraint = "PastPaper_questionPaperId_key";
const postgresError = (code: string, constraint?: string, message = "duplicate key value") =>
  Object.assign(new Error(message), { code, constraint });

test("finds a unique violation inside a Drizzle query error", () => {
  const wrapped = new DrizzleQueryError("update ...", [], postgresError("23505", linkConstraint));
  assert.equal(isUniqueViolation(wrapped), true);
  assert.equal(isUniqueViolation(wrapped, linkConstraint), true);
});

test("matches the constraint by name or by the driver message", () => {
  assert.equal(isUniqueViolation(postgresError("23505", linkConstraint), linkConstraint), true);
  const byMessage = postgresError("23505", undefined, 'violates unique constraint "pastpaper_questionpaperid_key"');
  assert.equal(isUniqueViolation(byMessage, linkConstraint), true);
  assert.equal(isUniqueViolation(postgresError("23505", "Course_code_key"), linkConstraint), false);
});

test("other errors are not unique violations", () => {
  assert.equal(isUniqueViolation(new DrizzleQueryError("insert ...", [], postgresError("23503"))), false);
  assert.equal(isUniqueViolation(new Error("Failed query")), false);
  assert.equal(isUniqueViolation(null), false);
});
