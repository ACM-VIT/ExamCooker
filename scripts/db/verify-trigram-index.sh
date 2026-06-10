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
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  const result = await client.query(
    'EXPLAIN SELECT "name" FROM "Tag" WHERE "name" ILIKE $1',
    ['%foo%'],
  );
  console.log(result.rows.map((row) => Object.values(row).join(' | ')).join('\n'));
}

main()
  .then(() => client.end())
  .catch(async (error) => {
    console.error(error);
    await client.end();
    process.exit(1);
  });
NODE
fi
