# Repository Guidelines

## Project Structure & Module Organization
`app/` contains the Next.js App Router application, including route groups like `(app)` and `(mod)`, API routes under `app/api/`, and UI components under `app/components/`. Shared logic lives in `lib/`, database access and schema code live in `db/`, and Drizzle migrations/config are in `drizzle/` and `drizzle.config.ts`. Static assets are served from `public/`. Operational and backfill scripts live in `scripts/`. The workspace CLI is isolated in `packages/cli/`.

## Build, Test, and Development Commands
Use `pnpm` at the repository root.

- `pnpm dev`: syncs generated course data, then starts the Next.js dev server.
- `pnpm build`: syncs data and builds the production app.
- `pnpm start`: runs the built app locally.
- `pnpm lint`: runs `next lint` across the web app.
- `pnpm cli:build`: builds the CLI package in `packages/cli/`.
- `pnpm cli:dev -- <args>`: runs the CLI from source for local iteration.
- `pnpm --filter examcooker typecheck`: type-checks the CLI package.

## Coding Style & Naming Conventions
TypeScript is the default for application code; keep new web code in `.ts` or `.tsx`. Follow the existing style: 2-space indentation in most files, semicolons enabled, and import aliases via `@/` from the repo root. Use `PascalCase` for React components, `camelCase` for functions and variables, and descriptive kebab or snake case only where the file pattern already uses it. Run `pnpm lint` before opening a PR.

## Testing Guidelines
There is no dedicated automated test suite configured yet. For UI or route changes, validate with `pnpm dev` and exercise the affected pages or API endpoints manually. For CLI changes, run `pnpm cli:dev -- --help` or the specific command you changed, then finish with `pnpm --filter examcooker typecheck`. If you add tests, colocate them near the feature and name them after the target module.

## Commit & Pull Request Guidelines
Recent history favors short, imperative commits, usually prefixed with `feat:` or `fix:`. Keep commits focused on a single concern and avoid vague messages like `misc updates`. PRs should include a clear summary, linked issue or task, notes on schema or script changes, and screenshots for visible UI updates. Call out any required environment variables, migrations, or manual verification steps in the PR description.

## Security & Configuration Tips
Never commit populated `.env` files or production secrets. Review scripts in `scripts/prod/` and storage/database utilities carefully before running them, since several are intended for live data movement or repair operations.
