# Architecture Overview

## Application Shape

ExamCooker is a Next.js App Router application backed by CockroachDB and cloud object storage. The main user-facing experiences live under `app/(app)/`, while moderator flows are isolated in `app/(mod)/`. Shared layouts, metadata routes, and route handlers are kept in `app/` so page logic stays close to the routes it serves.

## UI And Shared Logic

Reusable interface code lives in `app/components/`. Domain utilities and cross-cutting helpers live in `lib/`, including content datasets, PDF helpers, upload support, analytics wiring, and CLI-adjacent helpers. Keep rendering concerns in components and push data shaping into `lib/` or `db/` when the logic is reused.

## Data And Persistence

The primary relational model is defined in `db/schema.ts`, with migrations emitted into `drizzle/`. Query composition and database client setup live in `db/` and `db/index.ts`. Static media and downloadable assets are served from `public/`, while uploaded or migrated content is handled through storage utilities in `lib/uploads/` and `scripts/storage/`.

## Secondary Surfaces

The repository also contains a workspace CLI in `packages/cli/`. It reuses the broader project conventions but is built and type-checked independently from the web app. Operational scripts in `scripts/` handle data seeding, backfills, storage migrations, and production repair tasks; treat those scripts as part of the system boundary, not as one-off throwaway code.
