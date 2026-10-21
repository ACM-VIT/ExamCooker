# Development

Use Node.js 24 and pnpm 12.8.1 (pinned in `package.json`).

```sh
git submodule update --init --recursive
pnpm install --frozen-lockfile
```

Before starting the app, create `.env` with `DATABASE_URL` for a development
CockroachDB database, `AUTH_SECRET` / `NEXTAUTH_SECRET`, and the provider settings
you need. Set `NEXTAUTH_URL` / `NEXT_PUBLIC_BASE_URL` to `http://localhost:3000`.
Google sign-in requires valid `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` values.
Never commit populated environment files.

Start the app with `pnpm dev` after configuring the environment.

`pnpm dev` and `pnpm build` generate the MCP appearance module, copy PDFium
assets, and refresh course data before running Next.js. The course sync falls
back to the checked-in dataset when its upstream is unavailable.

## Commands

- `pnpm build` / `pnpm start`: build and serve the app.
- `pnpm exec tsc --noEmit`: check web types.
- `pnpm mcp:test`: run MCP tests.
- `pnpm exec tsx --test path/to/module.test.ts`: run a focused test.
- `pnpm cli:build`: build the CLI.
- `pnpm exec tsx packages/cli/src/cli.ts --help`: run the CLI from source.
- `pnpm --filter examcooker typecheck`: check CLI types.

There is no ESLint setup. Next.js 16 removed `next lint`.
Exercise changed pages and API routes with the dev server as well.

## Layout

`app/` holds routes and components; `lib/` holds shared logic and tests.
Database clients, queries, and schema live in `db/`, with migrations in
`drizzle/`. The CLI is in `packages/cli/`; Cloudflare Workers and adapters are
in `cloudflare/` and `worker/`.

Seed and backfill commands remain in `scripts/`. Check their target database
and dry-run options before running them.
