# Repository guidelines

Use pnpm at the repository root. Setup, commands, and layout are documented in
[docs/development.md](docs/development.md). Initialize submodules before
installing so the workspace lockfile stays complete.

Use TypeScript for application code, 2-space indentation, semicolons, and `@/`
imports. Follow existing component and module naming. Keep database changes in
`db/` and `drizzle/`.

Run typechecks and focused tests for changed behavior, and exercise affected
pages or endpoints with `pnpm dev`. There is no ESLint setup; `next lint` was
removed in Next.js 16. Keep tests near the feature and avoid one-off benchmark
or source-text assertion scripts.

Use focused, imperative commits. PRs should describe the behavior change,
validation, and any environment variables, migrations, or manual steps.
Include screenshots for visible UI changes.

Never commit populated environment files or production secrets. Review
database and storage utilities before running them against live services.
Cloudflare production and preview deployment are documented in
[docs/cloudflare-rollout.md](docs/cloudflare-rollout.md).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
