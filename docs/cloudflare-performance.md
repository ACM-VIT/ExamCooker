# Cloudflare performance measurements

Measured on September 12, 2026 against `examcooker.acmvit.in` and `ec-test.acmvit.in`. The first optimization pass ended on Worker `6828eb92-82b9-4ce0-a3c6-c4e90d470a5f`; the follow-up experiments below ended on `300bdd63-3ae4-4fd6-a158-ad374693165f`, with the same application source and default placement. Azure production was not redeployed.

## Changes retained

- Hyperdrive `examcooker-test-db` (`37449c92cf764de4b7c8be5b128c99cd`), SQL response caching disabled, soft origin connection limit 10. Worker pg clients remain request-scoped; Node still uses DATABASE_URL directly.
- Regional Cache API reads for versioned public paper/course payloads, up to 60 seconds and never past R2 expiry. The DO namespace counter remains authoritative; edits switch cache keys. No sessions, locks, votes or counters enter this cache.
- OpenNext tag replicas in six regions with reads selected by visitor continent. Tag metadata TTL remains five seconds. Invalidation writes reach every replica.
- Explicit negative caching for the optional question/answer-key sibling lookup. The measured paper has no sibling: this valid absence previously repeated cache reads, lock operations and SQL queries. Primary resource misses and exceptions still bypass negative caching.

## Component measurements

An authenticated temporary endpoint on ec-test compared direct CockroachDB connections with Hyperdrive using SELECT 1 twice per connection. Three samples per mode, from MAA:

| Measurement | Direct | Hyperdrive |
|---|---:|---:|
| Median connection setup | 505 ms | 6 ms |
| Median connection plus two queries | 561 ms | 115 ms |

The first Hyperdrive origin acquisition still incurs a cost; these results do not imply all queries take 6 ms. Pooling behavior is described in the [Hyperdrive documentation](https://developers.cloudflare.com/hyperdrive/concepts/how-hyperdrive-works/).

The corrected binding trace measured original tag reads around 160 ms; regional replicas reduced their median to 48 ms. Cold outliers remained. R2 reads were typically 100–200 ms; after public regional caching, successful warm versioned payload reads no longer needed R2. Background Next cache refreshes still use R2, and parallel operation durations must not be added to estimate response latency.

## Page latency

Each stage used five paired samples per route/type, plus one separately recorded warmup. At most two requests were in flight. These are HTTP response completion times, not browser click-to-paint, hydration or PDF rendering times. RSC probes send RSC: 1 without a browser router-state tree; browser prefetch hits are not measured. No media playback was involved.

Median complete HTML responses:

| Route | CF before | CF final | Production during final run |
|---|---:|---:|---:|
| DSA course | 1047 ms | 853 ms | 493 ms |
| Paper detail | 656 ms | 793 ms | 321 ms |
| DSA notes | 920 ms | 856 ms | 440 ms |
| DSA syllabus | 1400 ms | 855 ms | 492 ms |

Median RSC responses and the median difference within each simultaneous pair:

| Route | CF before | CF final | Production final | Paired CF penalty before | Paired CF penalty final |
|---|---:|---:|---:|---:|---:|
| DSA course | 580 ms | 652 ms | 372 ms | +158 ms | +237 ms |
| Paper detail | 1121 ms | 1056 ms | 590 ms | +490 ms | +552 ms |
| DSA notes | 1016 ms | 1461 ms | 835 ms | +714 ms | +498 ms |
| DSA syllabus | 1349 ms | 864 ms | 569 ms | +980 ms | +283 ms |

The end-to-end results are mixed. Database setup and tag reads improved, but production remains faster on these routes, and some final response medians regressed. Production/network timing also varied between stages, so sequential stage differences do not establish a precise causal speedup for each change. In particular, the optional-null optimization removes confirmed redundant work but has not demonstrated a clear page-level latency win in this sample. Do not treat this as performance parity or approval for a production cutover.

## Experiment history

Median Cloudflare complete responses (milliseconds):

| Stage | Course HTML | Paper HTML | Notes HTML | Syllabus HTML | Course RSC | Paper RSC | Notes RSC | Syllabus RSC |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Baseline | 1047 | 656 | 920 | 1400 | 580 | 1121 | 1016 | 1349 |
| Hyperdrive | 843 | 723 | 628 | 455 | 829 | 1047 | 822 | 716 |
| Public regional cache | 812 | 1788 | 783 | 489 | 938 | 1564 | 1060 | 811 |
| Regional tag replicas | 850 | 838 | 623 | 414 | 769 | 1029 | 830 | 588 |
| Clean deployment | 868 | 928 | 619 | 447 | 979 | 1187 | 1133 | 613 |
| Optional sibling cache (final) | 853 | 793 | 856 | 855 | 652 | 1056 | 1461 | 864 |

The first temporary tracer used an incompatible RPC wrapper; its page samples (`optimization-before.jsonl`) were discarded. The baseline above is the corrected tracer run (`optimization-before-fixed.jsonl`). The final two runs have no tracer. The temporary endpoint and EC_PERF_TOKEN secret were removed. Raw timing JSONL and protected diagnostics are retained locally under `.cloudflare-deploy/`; they are intentionally not committed.

## Validation and limits

- Full Next/OpenNext production build and app/Worker typechecks passed.
- workerd tests cover public-cache hits, expiry, namespace changes, deletion, and exclusion of session/state keys.
- A test using the actual OpenNext configuration verifies invalidation reaches all six tag regions.
- Optional-cache tests cover concurrent misses, new-sibling invalidation, primary 404s, and exception recovery.
- Atomic-state tests passed locally; session-isolation, render-stream/cancellation and revalidation checks passed on the final deployment.
- The known Next/OpenNext cache-warming warning still appears. The pinned compatibility patches remain required; no route-segment dynamic export was introduced and Cache Components stays enabled.
- Five samples cannot establish p95/p99 or cold-start behavior. These runs are from one client/network with Cloudflare ingress at MAA.

Reproduce without a browser (requires the repository dependencies):

```sh
node scripts/cloudflare/compare-response-times.mjs \
  --rounds 5 --mode both \
  --paths "/past_papers/BCSE202L,/past_papers/BCSE202L/paper/cmoeqh9nt022ka8v37i2rf75z,/notes/course/BCSE202L,/syllabus/course/BCSE202L" \
  --output /tmp/examcooker-latency.jsonl
```

## Follow-up: cache warming and partial prefetching

The next five-sample baseline measured HTML completion at 515/443/403/414 ms
(course/paper/notes/syllabus), versus production at 268/222/263/222 ms. First
bytes were similar, so most of the gap occurred after the initial response.

A temporary diagnostic build (`f07e9989-638d-45d3-8394-98aa2aaa7d35`) observed
46 cache-warming warnings across course, notes and syllabus probes. Every warning
had an empty resume-data cache and an already pending invocation for the same
key. This identifies premature runtime-prefetch rendering; it does not establish
that the warning accounts for the entire latency gap. Only counts and route
patterns were logged, not cache keys, arguments or session values.

Tested `partialPrefetching: false` on Cloudflare while retaining Cache Components
and PPR (`93cbabee-cf98-4122-b5d7-740c5fe7dbae`). The warnings disappeared, but
course, paper and notes became slower. The table reports the median latency
difference inside each simultaneous CF/production pair, in milliseconds:

| Route | Baseline HTML | Disabled HTML | Restored HTML | Baseline RSC | Disabled RSC | Restored RSC |
|---|---:|---:|---:|---:|---:|---:|
| Course | +247 | +608 | +504 | +128 | +419 | +189 |
| Paper | +174 | +747 | +238 | +245 | +591 | +376 |
| Notes | +126 | +973 | +1 | +286 | +682 | +285 |
| Syllabus | +204 | -67 | +7 | +285 | -215 | +23 |

Rejected the candidate and rolled back to `6828eb92-82b9-4ce0-a3c6-c4e90d470a5f`.
Both `cacheComponents` and `partialPrefetching` remain enabled. Runtime-prefetch
behavior changes more than payload size, so disabling it is not a targeted fix
for the scheduler. Raw reports: `warming-baseline.jsonl`, `warming-disabled.jsonl`
and `warming-restored.jsonl` in the ignored diagnostics directory.

Worker tail measurements on the diagnostic build recorded median CPU of 43–71 ms
versus wall time of 336–647 ms on those routes. Wall time can include background
work; this supports investigating I/O but is not a breakdown of response latency.
A small sequential Brotli/gzip/identity comparison did not establish a reliable
compression win, so compression configuration was unchanged.

## Follow-up: Mumbai placement

Tested `placement.region: "aws:ap-south-1"` with both caching features restored.
Cloudflare accepted targeted placement (Worker `64e9afd3-6584-4d35-8362-b395e80bb651`).
The execution-location header was not exposed in the captured request logs, so
the requested placement is verified through the control plane only.

Then disabled placement through the Worker settings API, preserving the same
application build and cache keys (`300bdd63-3ae4-4fd6-a158-ad374693165f`). A fresh
settings read confirmed empty placement settings. Five paired samples per case:

| Route | Targeted HTML | Default HTML | Targeted RSC | Default RSC |
|---|---:|---:|---:|---:|
| Course | 1458 | 504 | 1337 | 628 |
| Paper | 732 | 511 | 1168 | 668 |
| Notes | 1198 | 528 | 974 | 788 |
| Syllabus | 544 | 445 | 931 | 714 |

These are Cloudflare completion medians in milliseconds. Default placement won
in this sequence; targeted placement was removed from the configuration. The
sequence is not randomized and local network/production timing varied, so these
differences are not a precise causal estimate. Raw reports are
`placement-mumbai.jsonl` and `placement-off.jsonl`.

## Follow-up: combined syllabus cache

Added a public `use cache` boundary around `loadCourseSyllabusContext`, preserving
the child functions' propagated invalidation tags and using the same explicit
60/300/3600-second stale/revalidate/expire profile. A warm hit could return the
assembled result instead of making four independent child cache lookups.

Built and deployed the candidate (`75763613-8aa7-4572-9d28-e037abc84d41`), then
compared seven paired samples against a seven-sample baseline. Paper detail was
an unchanged control. Median paired CF penalties, milliseconds:

| Route | Before HTML | Combined HTML | Before RSC | Combined RSC |
|---|---:|---:|---:|---:|
| Syllabus | -10 | +164 | +131 | +209 |
| Unchanged paper | +20 | +158 | +350 | +296 |

This did not demonstrate a latency improvement. Reverted the source change and
rolled back to `300bdd63-3ae4-4fd6-a158-ad374693165f`. The unsuccessful candidate's
generated build artifacts were moved under the ignored diagnostics directory to
prevent accidental deployment; run `pnpm cf:build` before another deployment.
Raw reports: `aggregate-before.jsonl` and `aggregate-after.jsonl`.

No new runtime optimization from these three follow-up experiments was retained.
Cache Components, partial prefetching, Hyperdrive and the previously implemented
regional caches remain enabled. Default Worker placement is restored. Build and
PPR payload checks passed for the candidates; the final restored deployment was
checked for session isolation, concurrent rendering, cancellation recovery and
runtime-prefetch payloads. The known warming warning remains unresolved.
The final serial render checks took 423 ms for home, 4057 ms for `/past_papers`
and 3124 ms for `/notes`; nine subsequent concurrent renders completed with a
2064 ms maximum. These were correctness checks, not controlled cold-start
measurements, but they confirm that multi-second listing responses still occur.
