# Cloudflare performance measurements

Measured on September 12, 2026 against `examcooker.acmvit.in` and `ec-test.acmvit.in`. Final deployed Worker version: `6828eb92-82b9-4ce0-a3c6-c4e90d470a5f`. Azure production was not redeployed.

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
