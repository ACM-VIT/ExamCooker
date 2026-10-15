# Development Guide

Run these commands from the repository root. The web app uses Next.js 16, Drizzle, and a SQL database. The CLI in `packages/cli/` can run without a local database when pointed at an existing ExamCooker deployment.

## Prerequisites

- Node.js 20.9 or newer and `pnpm` 12.8.1 (the version in `package.json`).
- A disposable CockroachDB database for the full local web app. Production also uses CockroachDB; never use a production URL for local schema commands.
- Google OAuth credentials if you need to sign in. Placeholder credentials are enough to start the app, but cannot complete Google login.

## Set up the web app

1. Install dependencies:

   ```bash
   pnpm install --no-frozen-lockfile
   ```

   The current lockfile still names a removed workspace package, so a frozen install fails. A non-frozen install can update `pnpm-lock.yaml`; keep that incidental change out of unrelated commits.

2. Start a local CockroachDB instance or obtain a dedicated development CockroachDB URL. For the local option, install the [CockroachDB CLI](https://www.cockroachlabs.com/docs/stable/install-cockroachdb-mac.html), then run this in a separate terminal:

   ```bash
   mkdir -p "$HOME/.local/share/examcooker-cockroach"
   cockroach start-single-node --insecure --listen-addr=127.0.0.1:26257 --http-addr=127.0.0.1:8080 --store="$HOME/.local/share/examcooker-cockroach"
   ```

   Keep that terminal open. This insecure instance listens only on your machine and stores its data outside the repository. Back in the repository terminal, create the empty database:

   ```bash
   cockroach sql --insecure --host=127.0.0.1:26257 --execute 'CREATE DATABASE IF NOT EXISTS examcooker;'
   ```

   If your instance uses TLS or a different user, use its connection URL instead of the local example below.

3. Copy the environment template and edit it:

   ```bash
   cp env.example .env
   openssl rand -base64 32
   ```

   Put the generated value in `AUTH_SECRET`. Set `DATABASE_URL` to the disposable database, then keep `NEXTAUTH_URL` and `NEXT_PUBLIC_BASE_URL` at `http://localhost:3000` when using the default port. `AUTH_SECRET` or `NEXTAUTH_SECRET` signs sessions; `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are required by the auth provider. Add real Google credentials and register `http://localhost:3000/api/auth/callback/google` with the OAuth client to test sign-in. Apple sign-in uses optional `AUTH_APPLE_ID` and `AUTH_APPLE_SECRET`.

   `.env` is ignored by Git. Do not commit credentials.

4. Apply the schema to the database you selected, then start Next.js:

   ```bash
   pnpm exec drizzle-kit push --config drizzle.config.ts
   pnpm dev
   ```

   Open <http://localhost:3000>. The schema command reads `DATABASE_URL` from `.env` and writes to that database. `pnpm dev` generates the MCP UI assets and PDFium WASM asset, refreshes the VInTogether course catalog, then starts the Next.js development server. If the catalog fetch fails, the sync script uses the tracked snapshot in `lib/generated/vinTogether.json`.

A fresh database has no notes or past papers. Additional services, such as uploads and analytics, need their own credentials when you exercise those flows. Do not use the production copy, backfill, or repair scripts to populate a local database.

### PostgreSQL 16 limitation

The application uses PostgreSQL-compatible queries, but the repository's schema command currently targets CockroachDB. Against a clean PostgreSQL 16 database, `drizzle-kit push --config drizzle.config.ts` fails during Cockroach-specific introspection. Forcing the PostgreSQL dialect then fails on text GIN indexes in `db/schema.ts`. Use CockroachDB for the full setup above until there is a PostgreSQL-specific schema path.

## Build and run the production server locally

With the same environment and database available:

```bash
pnpm build
pnpm start
```

`pnpm build` runs the same asset and catalog sync scripts before building. It also reads database-backed pages while collecting page data, so a missing database can stop the build after compilation. `pnpm start` serves the completed build on <http://localhost:3000>.

## Run the workspace CLI

The CLI is separate from the web server. To run it from source against the hosted app:

```bash
pnpm exec tsx packages/cli/src/cli.ts --help
pnpm exec tsx packages/cli/src/cli.ts courses search "distributed systems"
```

Set `EXAMCOOKER_BASE_URL=http://localhost:3000` if you want the CLI to use your local web server. Authentication and uploads then need working provider and storage credentials. See [CLI commands](../packages/cli/README.md) for login, search, download, and upload examples.

## Check changes

```bash
pnpm exec next typegen
pnpm exec tsc --noEmit
pnpm --filter examcooker typecheck
pnpm exec tsx packages/cli/src/cli.ts --help
```

For UI or route changes, use `pnpm dev` and exercise the affected page or endpoint. There is no broad automated test suite. `pnpm lint` currently calls `next lint`, which Next.js 16 removed; it will fail until an independent lint command and configuration are added. Review `scripts/prod/` and storage or database scripts before running them, since several operate on live data.
