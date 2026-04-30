# Prisma vs Drizzle Benchmarks

## Why This Exists

During the migration from Prisma to Drizzle, the project compared both data layers against the same CockroachDB dataset to understand whether the migration improved the server-side query paths that matter most to ExamCooker.

## Scope

The benchmark focused on application-level database workloads, not browser rendering. It measured wall-clock latency for representative server-side reads such as recent papers, recent notes, filtered course-paper pages, paper detail pages, note detail pages, and exam-summary queries.

## Headline Result

Drizzle was the stronger result overall in the April 28, 2026 benchmark run.

| Workload | Prisma mean (ms) | Drizzle mean (ms) | Delta vs Prisma | Winner | Notes |
| --- | ---: | ---: | ---: | --- | --- |
| Recent papers | 159.805 | 83.459 | `-47.8%` | Drizzle | Lower mean latency on joined list reads |
| Recent notes | 93.582 | 77.973 | `-16.7%` | Drizzle | More stable and faster than Prisma |
| Course paper page | 203.222 | 77.305 | `-62.0%` | Drizzle | Large win on filtered page queries |
| Course paper filter options | 165.692 | 412.116 | `+148.7%` | Prisma | Full-suite outlier that did not reproduce in isolation |
| Paper detail | 136.218 | 71.925 | `-47.2%` | Drizzle | Faster after collapsing to a joined fetch |
| Note detail | 71.388 | 62.610 | `-12.3%` | Drizzle | Modest but consistent win |
| Exam hub summaries | 1250.837 | 85.349 | `-93.2%` | Drizzle | Major improvement on aggregate reads |

In the main run, Drizzle won `6/7` measured paths on mean latency. The only apparent loss, `coursePaperFilterOptions`, did not reproduce in an isolated rerun and should be treated as benchmark noise rather than a confirmed regression.

## Overall Averages

Across all seven measured workloads, the simple arithmetic mean was:

- Prisma: `297.249ms`
- Drizzle: `124.391ms`
- Net result: Drizzle was `58.2%` faster

On the core page-query subset (`recentPapers`, `recentNotes`, `coursePapersPage`, and `pastPaperDetail`), Drizzle averaged `77.666ms` versus Prisma at `148.207ms`, a `47.6%` improvement.

## Isolated Rerun

Because `coursePaperFilterOptions` was the only full-suite loss for Drizzle, it was rerun in isolation. That rerun showed near parity instead of a regression:

| Workload | Prisma mean (ms) | Drizzle mean (ms) | Winner |
| --- | ---: | ---: | --- |
| Course paper filter options | 97.090 | 94.297 | Drizzle |

## What Contributors Should Take From It

- New data-layer work should assume Drizzle is the primary path.
- Read-heavy pages benefit from targeted query shapes instead of ORM fanout patterns.
- Benchmarks in this area should measure real application workloads, not just isolated SQL snippets.

## Detailed Source

The full benchmark write-up, including dataset snapshot, methodology, and raw statistics, is maintained in the repository root at `PRISMA_VS_DRIZZLE_BENCHMARKS.md`. This page is the short-form reference for contributors who only need the architectural takeaway.
