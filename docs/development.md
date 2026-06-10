# Development Guide

## Prerequisites

- Node.js `20+`
- `pnpm`
- A valid `.env` or `.env.local` with the database and provider settings needed for the flows you are testing

## Common Commands

- `pnpm dev`: syncs generated course data, then starts the web app locally.
- `pnpm build`: runs the production build for the Next.js app.
- `pnpm start`: serves the built app.
- `pnpm lint`: runs the app lint checks.
- `pnpm cli:build`: builds the CLI package in `packages/cli/`.
- `pnpm cli:dev -- <args>`: runs the CLI entrypoint from source.
- `pnpm --filter examcooker typecheck`: type-checks the CLI package.

## Typical Workflow

For product work, start in `app/`, `app/components/`, `lib/`, and `db/`. For schema or query changes, update the Drizzle-backed code path first and keep migrations in `drizzle/` consistent with the schema changes. For CLI work, keep changes scoped to `packages/cli/` unless you are deliberately reusing shared helpers from the root app.

## Validation Expectations

This repository does not currently ship with a broad automated test suite, so local verification matters. Run `pnpm lint` for web changes, exercise the affected pages or routes with `pnpm dev`, and use CLI-specific commands plus `pnpm --filter examcooker typecheck` for CLI work. If your change touches storage, uploads, or production repair scripts, document the manual verification steps in the PR.

## Environment And Safety

Do not commit live secrets or populated environment files. Review `scripts/prod/` and storage/database scripts carefully before execution because several are intended for real data movement rather than local-only development.
