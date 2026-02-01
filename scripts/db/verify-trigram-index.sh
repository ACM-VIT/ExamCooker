#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Export it before running." >&2
  exit 1
fi

if [[ "${DATABASE_URL:0:1}" == "\"" && "${DATABASE_URL: -1}" == "\"" ]]; then
  DATABASE_URL="${DATABASE_URL:1:${#DATABASE_URL}-2}"
fi
if [[ "${DATABASE_URL:0:1}" == "'" && "${DATABASE_URL: -1}" == "'" ]]; then
  DATABASE_URL="${DATABASE_URL:1:${#DATABASE_URL}-2}"
fi
export DATABASE_URL

SQL_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/verify-trigram-index.sql"

if command -v cockroach >/dev/null 2>&1; then
  cockroach sql --url "$DATABASE_URL" -f "$SQL_FILE"
elif command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -f "$SQL_FILE"
else
  node - <<'NODE'
const path = require('node:path');
const { PrismaClient } = require(path.resolve(process.cwd(), 'src/generated/prisma'));

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe('EXPLAIN SELECT "name" FROM "Tag" WHERE "name" ILIKE %L', '%foo%');
  console.log(rows.map(r => Object.values(r).join(' | ')).join('\n'));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
NODE
fi
