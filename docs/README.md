# Project Documentation

This folder provides a high-level map of the ExamCooker codebase and the main contributor workflows. It is intentionally general: use it to orient yourself before diving into route files, scripts, or data-access code.

## Start Here

- [Architecture](./architecture.md): application shape, major modules, and runtime responsibilities.
- [Development](./development.md): local setup, common commands, and validation expectations.
- [Data Access](./data-access.md): database layout, migration ownership, and query-layer guidance.
- [Prisma vs Drizzle Benchmarks](./benchmarks/prisma-vs-drizzle.md): summary of the migration-era performance comparison that informed the current data-layer direction.

## Repository At A Glance

- `app/`: Next.js App Router pages, layouts, server actions, and API routes.
- `app/components/`: shared UI and feature-specific React components.
- `lib/`: shared utilities, data helpers, PDF tooling, uploads, CLI helpers, and analytics integrations.
- `db/` and `drizzle/`: schema definitions, query code, and generated SQL migrations.
- `packages/cli/`: the standalone ExamCooker CLI workspace package.
- `scripts/`: seed, repair, migration, and operational tooling.

## Documentation Conventions

- Keep pages general unless the topic is inherently operational.
- Prefer explaining system boundaries and workflows over file-by-file inventories.
- When adding new docs, link them here so contributors can discover them quickly.
