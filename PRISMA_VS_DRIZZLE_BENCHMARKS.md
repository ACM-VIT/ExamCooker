# Prisma vs Drizzle Benchmarks

Date: April 28, 2026

## Scope

This document compares the Prisma baseline on `main` against the current Drizzle migration branch for the server-side data access layer.

Benchmarked code state:

- Prisma baseline: `main` at commit `11df1fb`
- Drizzle: migration commit

Database and execution context:

- Database: live CockroachDB, same `DATABASE_URL` for both runs
- Benchmarks were run sequentially, not in parallel, to avoid branch-vs-branch DB contention
- Measurements are wall-clock latency in milliseconds
- The benchmark targets the ORM/data-access layer, not full browser rendering or route TTFB
- `next/cache` wrappers (`cacheTag`, `cacheLife`) were intentionally excluded because they are not callable from the CLI benchmark harness

## Dataset Snapshot

Database snapshot used during the benchmark run:

| Metric | Value |
| --- | ---: |
| Courses | 750 |
| Notes | 565 |
| Past papers | 3309 |
| Forum posts | 10 |
| Subjects | 2 |
| Syllabi | 524 |

Benchmark anchor records:

- Anchor course: `BMAT201L` (`Complex Variables and Linear Algebra`)
- Anchor course id: `cmoai03pj00bbv3nyts8rqygl`
- Clear papers for anchor course: `88`
- Sample paper id: `cmoe0kzke00k6v3ush08bx5pc`
- Sample note id: `cm40etwb800018vpbvlk3ffmy`

Benchmark filters used for the course page workload:

- Exam types: `CAT_1`, `CAT_2`, `FAT`, `MODEL_CAT_1`, `MODEL_FAT`
- Slots: `A1`, `A2`, `B2`
- Years: `2025`, `2024`, `2023`
- Semesters: `FALL`
- Campuses: `VELLORE`

## Methodology

Two benchmark groups were used:

- Core suite: `10` warmup iterations, `40` measured iterations
- Targeted hot paths: `5` warmup iterations, `20` measured iterations

Workloads:

| Query | What it measures | Iterations |
| --- | --- | --- |
| `recentPapers` | latest clear papers with joined course metadata | `10` warmup / `40` measured |
| `recentNotes` | latest clear notes with joined course metadata | `10` warmup / `40` measured |
| `coursePapersPage` | filtered course paper page: total count + first page | `10` warmup / `40` measured |
| `coursePaperFilterOptions` | filter-option row fetch + in-process aggregation for a course | `10` warmup / `40` measured |
| `pastPaperDetail` | paper detail with author, tags, and course | `10` warmup / `40` measured |
| `noteDetail` | note detail with author, tags, and course | `5` warmup / `20` measured |
| `examHubSummaries` | all exam-type summary cards across the corpus | `5` warmup / `20` measured |

## High-Level Result

- In the main run, Drizzle won `6/7` benchmarked paths on mean latency.
- The only full-suite loss for Drizzle was `coursePaperFilterOptions`, but that result did not reproduce in isolation. An isolated rerun on the same day showed near parity with a slight Drizzle edge.
- On the stable core page queries (`recentPapers`, `recentNotes`, `coursePapersPage`, `pastPaperDetail`), Drizzle averaged `77.666ms` vs Prisma `148.207ms`, which is `47.6%` faster on a simple arithmetic mean.
- On targeted hot paths, Drizzle was `12.3%` faster on `noteDetail` and `93.2%` faster on `examHubSummaries`.

## Summary Table

Main benchmark run:

| Query | Prisma mean (ms) | Drizzle mean (ms) | Delta vs Prisma | Winner |
| --- | ---: | ---: | ---: | --- |
| `recentPapers` | 159.805 | 83.459 | `-47.8%` | Drizzle |
| `recentNotes` | 93.582 | 77.973 | `-16.7%` | Drizzle |
| `coursePapersPage` | 203.222 | 77.305 | `-62.0%` | Drizzle |
| `coursePaperFilterOptions` | 165.692 | 412.116 | `+148.7%` | Prisma |
| `pastPaperDetail` | 136.218 | 71.925 | `-47.2%` | Drizzle |
| `noteDetail` | 71.388 | 62.610 | `-12.3%` | Drizzle |
| `examHubSummaries` | 1250.837 | 85.349 | `-93.2%` | Drizzle |

Simple arithmetic mean across all seven measured workloads:

- Prisma: `297.249ms`
- Drizzle: `124.391ms`
- Delta: Drizzle `58.2%` faster

## Detailed Statistics

| Query | ORM | Mean | Median | p95 | Min | Max | Stddev |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `recentPapers` | Prisma | 159.805 | 103.145 | 419.451 | 58.542 | 581.124 | 129.677 |
| `recentPapers` | Drizzle | 83.459 | 73.728 | 144.629 | 56.808 | 204.206 | 30.142 |
| `recentNotes` | Prisma | 93.582 | 82.595 | 140.102 | 65.629 | 222.909 | 31.197 |
| `recentNotes` | Drizzle | 77.973 | 79.176 | 91.142 | 60.922 | 99.022 | 9.771 |
| `coursePapersPage` | Prisma | 203.222 | 89.221 | 773.257 | 57.020 | 1617.503 | 297.533 |
| `coursePapersPage` | Drizzle | 77.305 | 71.144 | 113.084 | 55.883 | 134.904 | 18.641 |
| `coursePaperFilterOptions` | Prisma | 165.692 | 129.346 | 328.810 | 67.413 | 391.584 | 83.170 |
| `coursePaperFilterOptions` | Drizzle | 412.116 | 319.705 | 1102.241 | 62.531 | 1912.167 | 411.424 |
| `pastPaperDetail` | Prisma | 136.218 | 70.898 | 372.988 | 54.098 | 988.814 | 166.320 |
| `pastPaperDetail` | Drizzle | 71.925 | 73.751 | 89.481 | 54.122 | 123.899 | 13.548 |
| `noteDetail` | Prisma | 71.388 | 76.144 | 90.137 | 53.392 | 112.935 | 15.271 |
| `noteDetail` | Drizzle | 62.610 | 57.749 | 85.876 | 50.103 | 95.873 | 12.098 |
| `examHubSummaries` | Prisma | 1250.837 | 819.843 | 3082.489 | 387.986 | 4098.259 | 1028.839 |
| `examHubSummaries` | Drizzle | 85.349 | 83.395 | 107.727 | 58.466 | 113.661 | 15.449 |

## Isolated Verification Rerun

`coursePaperFilterOptions` was the only query where the full-suite result strongly contradicted earlier spot checks. Because that path fetches only `88` rows for the anchor course and uses simple in-process aggregation, it was rerun in isolation on both branches.

Isolated rerun result:

| Query | ORM | Mean | Median | p95 | Min | Max |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `coursePaperFilterOptions` | Prisma | 97.090 | 78.464 | 181.021 | 64.758 | 246.504 |
| `coursePaperFilterOptions` | Drizzle | 94.297 | 75.233 | 178.510 | 60.508 | 184.848 |

Interpretation:

- The suite-level Drizzle result for `coursePaperFilterOptions` (`412.116ms` mean) is almost certainly a noisy outlier rather than a stable regression.
- In isolation, the two implementations are effectively at parity, with Drizzle slightly faster on mean and median.
- This isolated rerun is more consistent with earlier spot checks from the same migration session.

## Interpretation

What the data says:

- Drizzle is clearly better on list-style joined reads in this repo.
- Drizzle is clearly better on the paper detail path after collapsing the old two-query shape into one joined fetch.
- Drizzle is clearly better on the exam hub summary path after replacing the Prisma fanout pattern with a grouped query.
- Note detail is modestly faster on Drizzle after the same one-query join optimization used for paper detail.
- Prisma still showed high variance on multiple workloads, especially `coursePapersPage`, `pastPaperDetail`, and `examHubSummaries`.

What this does not say:

- This is not a browser-performance benchmark.
- This does not measure client hydration, PDF viewer render cost, asset loading, or route transition smoothness.
- This does not isolate raw SQL engine performance from ORM overhead with `EXPLAIN ANALYZE`; it measures the actual app-level query shapes used by each branch.

## Final Read

As of April 28, 2026, the current Drizzle working tree is materially faster than the Prisma baseline on the important server-side workloads that were measured here.

The practical conclusion is:

- Drizzle is the better data layer for this repo in its current optimized form.
- The biggest wins are on broad read paths and aggregate pages.
- The one apparent loss in the full suite (`coursePaperFilterOptions`) does not hold up under isolated rerun and should not be treated as a real blocker.
