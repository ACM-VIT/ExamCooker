# Data Access

## Current Direction

The repository currently treats Drizzle as the primary relational data layer. Schema definitions, query types, helpers, and authentication adapters live in `db/`, while migration artifacts live in `drizzle/`. New database work should follow that path unless you are explicitly handling migration or compatibility work.

## Query Ownership

- `db/schema.ts`: table and relation definitions.
- `db/index.ts`: database client setup, pooling behavior, and shared query plumbing.
- `db/helpers.ts`, `db/types.ts`, and adjacent files: reusable data-shaping helpers and shared types.

Keep heavy query logic close to the data layer instead of spreading SQL-shaped transformations across pages and components. That makes performance tuning and migration work easier.

## Performance Guidance

Prefer joined, purpose-built reads for page workloads rather than fanout-heavy fetch patterns. The benchmark summary in [Prisma vs Drizzle Benchmarks](./benchmarks/prisma-vs-drizzle.md) captures why: the current Drizzle query shapes materially improved several core read paths on the same CockroachDB dataset.
