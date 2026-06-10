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

SQL_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/trigram-index.sql"

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
  await client.query('DROP INDEX IF EXISTS "Tag_name_trgm_idx"');
  await client.query('CREATE INDEX "Tag_name_trgm_idx" ON "Tag" USING GIN ("name" gin_trgm_ops)');
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
