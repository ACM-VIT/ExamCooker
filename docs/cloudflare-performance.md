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

## Follow-up: retain late streaming cache writes

A nested Worker-side trace exposed composable cache keys that repeatedly missed
on warm requests. Their R2 writes started near stream completion but remained
unfinished when the registered background work finished. The trace contained
39 HTML cache writes, of which 17 were still unfinished. For example, the paper
listing repeatedly missed keys `419d7598f604` and `5229db60eb35` (SHA-256 prefixes,
not raw cache keys), adding 128–183 ms of R2 reads before loading public data.
Paper detail showed the same behavior for `a31a3bb15e38`.

Next starts some cache fills during streaming, after `app-render` snapshots the
pending revalidation promises. The existing OpenNext incremental-cache `set`
awaited R2 but did not itself register the write with the Worker context. This
supports a request-lifetime failure: an outstanding promise alone does not retain
an invocation after its response completes. See Cloudflare's
[context lifetime documentation](https://developers.cloudflare.com/workers/runtime-apis/context/).

Added `withCacheWriteLifetime` around the configured incremental cache. Each
write registers its complete R2 and regional-cache promise with `ctx.waitUntil`,
then returns that same promise to the caller. HTTP streaming does not await it.
The wrapper does not alter cache keys, tags, data expiry, or response-cache policy.
The normal Workers background execution limit still applies; this is not a
persistent retry queue.

Compared diagnostic baseline `4f4f42ec-6f43-4434-81af-4605b8c5e98c` with candidate
`8392669a-ff5e-403d-be6a-3a48a78b800d`, retaining the exact Next build and cache keys
with `--skipNextBuild`. The candidate trace contained five HTML cache writes;
all five completed, including writes ending after the response. Previously
missing keys subsequently returned hits. Some first follow-up requests still
missed while the preceding request's write was in flight.

Median Worker-internal stream completion, milliseconds, rounds 1–3 after a
separately recorded first request:

| Route | Before HTML | Retained writes HTML | Before RSC | Retained writes RSC |
|---|---:|---:|---:|---:|
| Home | 26 | 80 | 89 | 94 |
| Paper listing | 237 | 34 | 32 | 33 |
| Notes listing | 217 | 81 | 70 | 24 |
| Paper detail | 247 | 66 | 746 | 198 |

These are small, sequential diagnostic samples, not controlled cold-start or
browser paint measurements. The temporary wrapper drains the response within the
Worker and traces parent/child cache operations; background R2 refreshes are
excluded from response time. Its fast drain can expose the lifetime failure more
readily than a slow client. Intervening ordinary HTTP probes also warmed caches,
so the complete numerical difference cannot be attributed solely to the wrapper.
The completed writes and subsequent hits provide the direct correctness evidence.

Ordinary HTML completion medians in the initial five-pair comparison were
472→234 ms for home, 431→317 ms for papers, 528→633 ms for notes, and 557→329 ms
for paper detail. Production changed substantially during the same sequence.
A seven-pair paper repeat measured 271 ms on Cloudflare versus 286 ms on Azure.
The improvement is not uniform, and occasional multi-second responses remain.

Validation: application and Worker typechecks, OpenNext build, PPR resume-payload
parsing in workerd, delayed R2 writes across eight concurrent workerd requests,
write failure propagation, session A/B/anonymous isolation, chunked cookies,
CSRF isolation, concurrent/canceled response streams, runtime prefetch payloads,
and forced HEAD/GET revalidation passed. The new regression test is
`node scripts/cloudflare/test-cache-write-lifetime.mjs`.

Raw local reports: `critical-baseline-spans.jsonl`, `lifetime-spans.jsonl`,
`critical-background-spans.jsonl`, `lifetime-before.jsonl`, `lifetime-after.jsonl`,
`lifetime-paper-repeat.jsonl` under the ignored `.cloudflare-deploy/` directory.
Wrangler's raw tail contains request headers and must not be published.

### Corrected RSC measurement

Earlier ordinary RSC probes sent `rsc: 1` without the matching `_rsc` query hash.
Next responded with a 307 before serving the Flight response, and the benchmark
included that extra round trip. Next's router supplies this hash itself; see the
[Next CDN guide](https://nextjs.org/docs/app/guides/cdn-caching).

The benchmark now discovers each deployed server's canonical RSC URL before
measurement, accepts only the same URL with an added `_rsc` parameter, and rejects
unexpected redirects during timed samples. It records whether the hash was sent.
Earlier RSC numbers remain useful as synthetic redirect-plus-response timings,
but must not be presented as direct client-navigation timings. The probe still
requests a full Flight payload without a router-state tree and does not measure
hydration, prefetch reuse, or click-to-paint latency.

### Follow-up: missing full-route shell lookups

After retaining writes, warm paper-detail RSC still waited 130–180 ms for a
full-route cache lookup before reading its now-cached data. The key was the actual
paper URL. R2 consistently returned no shell for that key; Next then rendered the
page. HTML could use the PPR fallback shell, while the full Flight request still
attempted this concrete-path lookup.

Added `withFullRouteMissCache`, an isolate-local map of at most 256 timestamps
with a five-second expiry and a 1024-character key limit. Only explicit full-route
`cache` lookups are eligible. A remembered miss returns `null` to Next, which still
renders the page and performs its normal data-cache/tag checks. No response,
session, promise, stream, or data-cache value is retained. Local shell writes and
deletions clear the marker before and after storage; a mutation generation stops
an older in-flight read from installing a miss after a write. A shell created by
another isolate may be bypassed for up to five seconds, causing an extra render
rather than returning stale content. Upstream adapters can represent storage
errors as misses; those also fall back to rendering during this short interval.

Candidate `412d7da7-7130-4fef-95fb-96019e949e76` retained the same Next build.
The initial two traced RSC requests still fetched R2 (166 and 287 ms); the next
five skipped that lookup entirely and completed internal rendering in
66, 74, 59, 35 and 39 ms. The six samples after the first request had a 62.5 ms
median, compared with 198 ms after the write-lifetime fix alone. The map is local
to an isolate, so first requests, other isolates and expired entries still read R2.

Seven ordinary paired RSC samples, with the correct `_rsc` hash, measured:

| Metric | Before miss cache | After miss cache |
|---|---:|---:|
| Cloudflare first byte | 286 ms | 164 ms |
| Cloudflare complete response | 397 ms | 258 ms |
| Production complete response | 351 ms | 335 ms |

The Cloudflare completion median improved by 35% in this sequence. This is a
small warm-request comparison, not a p95 or global latency guarantee. Raw reports:
`route-misses-before.jsonl`, `route-misses-after.jsonl`, and
`route-misses-spans.jsonl` in the ignored diagnostics directory.

`node scripts/cloudflare/test-full-route-misses.mjs` verifies expiry, capacity,
key length, exclusion of fetch/composable caches, write/delete invalidation,
in-flight read/write ordering, and exception propagation. Both app and Worker
typechecks and the OpenNext bundle passed.

### Final clean deployment

Both changes are active on `ec-test.acmvit.in`. The clean code deployment was
`e8669a31-5a23-4dd3-bba2-a5bada8bddd7`; deleting the temporary diagnostic secret
created active version `50855842-76d2-43a4-82ea-b90038e55fcc`. The tracing wrapper
is absent and its tail process is stopped. Production was not deployed or edited.

After cleanup and correctness checks, a final seven-pair anonymous comparison
recorded these complete-response medians in milliseconds:

| Route | Production HTML | Cloudflare HTML | Production RSC | Cloudflare RSC |
|---|---:|---:|---:|---:|
| Home | 553 | 319 | 1518 | 373 |
| Paper listing | 367 | 251 | 680 | 375 |
| Notes listing | 397 | 423 | 644 | 324 |
| Paper detail | 352 | 281 | 322 | 200 |

All samples returned complete, valid payloads. Warmup is excluded. Production
also varied considerably between runs (particularly home RSC), so this final table
is a contemporaneous comparison, not a causal estimate of the changes. Neither
HTML nor full Flight completion is click-to-paint time. Raw samples are in
`cache-fixes-final.jsonl` under the ignored diagnostics directory.

Final live session isolation, CSRF, chunked-cookie, concurrent rendering,
cancellation recovery, runtime prefetch, and forced HEAD/GET revalidation checks
passed. Nine concurrent streams had a 3119 ms maximum; forced revalidation took
1384–2614 ms. Cold/expired-cache rendering and latency under concurrency still
need improvement even though the targeted warm-request penalties were reduced.
Lint remains unavailable because the repository has no standalone ESLint setup
and Next 16 removed `next lint`.

## BMAT202L: first-visit and visible-page latency

The user reported a 5–6 second load for `/past_papers/BMAT202L`. The earlier warm
HTTP medians did not represent this experience. An isolated headless Chrome probe
recorded cards becoming visible at 4504 ms, first contentful paint at 4840 ms and
load completion at 5387 ms. That first capture included media interception.
A repeat without interception recorded a 8318 ms load, with Cloudflare reporting
5160 ms of Worker time in the navigation's `Server-Timing` header. A regular
Chrome user-agent repeat took 2760 ms; results were variable. These were anonymous
sessions with audio muted and playback disabled; the browser was closed afterward.

A temporary nested server trace on BMAT202L then recorded 5250 ms of internal
stream completion. The initial shell read took 282 ms, followed by a 1618 ms
cache-tag validation. Course/syllabus data reads were hits, but their subsequent
tag validation took up to 2110 ms. This identified sequential tag metadata I/O as
a major delay rather than a missing paper query alone. The trace is in
`bmat-trace-before.jsonl` in the ignored diagnostics directory.

### Start course-tag reads alongside the shell

`withCourseTagPrefetch` starts metadata reads for `courses`, `notes`, `past_papers`,
`syllabus` and `upcoming_exams` at the first course-shell cache lookup. OpenNext
stores the resolved metadata in its existing request-local tag cache, so later
normal invalidation checks can reuse it. A WeakSet limits this work to once per
request. Auth routes, upload/create routes and data-cache lookups do not trigger
it. The normal tag checks, five-second regional TTL and cross-region writes remain
unchanged. There are no cross-request promises or cached session values.

Candidate `ebfbfde0-7377-42d6-a2a3-5ccc83431e60` retained the same Next build and
cache keys. Its first traced HTML response took 3816 ms; the hard-tag prefetch ran
from 0–1614 ms, and later course/syllabus invalidation checks completed immediately.
Warm HTML internal completion was 85–143 ms. One forced revalidation still took
6360 ms, so this change alone did not resolve the slow tail.

### Avoid schema writes when tag objects restart

OpenNext's tag Durable Object constructor executed `CREATE TABLE IF NOT EXISTS`
and attempted `ALTER TABLE` on every activation. The compatibility patch now
inspects `PRAGMA table_info(revalidations)` first, creates a missing table, and
adds only missing columns individually. An initialized object performs no schema
writes on restart. This also handles the partially migrated case where `stale`
already exists but `expire` does not; the old combined ALTER would fail on the
first existing column. Existing tag rows are preserved.

Candidate `7f39c6e4-344f-4199-9f3b-cab0f6d55cfb` changed only the Durable Object
module after the prefetch candidate. Its first trace completed internally in
1489 ms. Tag-object reads in that trace took 46–64 ms, compared with 1204–2097 ms
in the original trace. The first shell read was also faster, so this sequential
comparison does not attribute the entire improvement to the schema change.
These are first probes after deployment, not guaranteed empty-cache cold starts.
Cloudflare can evict idle objects, and their constructors run again on activation;
see the [Durable Object lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/).

Workerd tests verify that prefetch overlaps shell reads, runs once per request,
isolates concurrent requests and does not block page reads after a failed prefetch.
SQLite tests verify new, existing and partially migrated schemas, preserved rows,
and no DDL or writes when reconstructing an initialized tag object. The real
workerd regional-tag test still passes across all six regions. The complete
Cloudflare patch was applied successfully to a pristine 1.20.6 package, and its
schema source matches the tested/deployed module. The lockfile changes only the
patch hash; pnpm's supply-chain verification passed. An offline reinstall could
not complete because a pre-existing esbuild tarball was absent from the store.

The benchmark now prints the first-request duration and the slowest measured
sample alongside warm medians. Neither full HTML nor Flight completion is a
browser paint measurement. Raw browser reports are `bmat-browser-*.json`; server
reports are `bmat-trace-before.jsonl`, `bmat-trace-after.jsonl` and
`bmat-trace-schema.jsonl`, all under the ignored diagnostics directory.

### Clean deployment: visible latency is still unresolved

The clean Worker deployment was `e0d458fa-52f5-43d8-ba54-5ad5993acee4`.
Removing the temporary diagnostic secret activated the same code as
`dcd5d8aa-e249-4341-bb9c-b895ff80ab2f`. The tracing wrapper is absent from this
deployment. No production deployment or database data changed.

A fresh, muted headless browser with a regular Chrome user agent and no network
interception still reproduced a slow BMAT202L visit. The following visits were
sequential on the same client, not a controlled statistical comparison:

| Visit | HTML complete | First contentful paint | 24 cards visible | Window load |
| --- | ---: | ---: | ---: | ---: |
| Cloudflare, fresh browser | 5954 ms | 7076 ms | 6919 ms | 8228 ms |
| Production, same browser | 1467 ms | 2428 ms | 2739 ms | 3523 ms |
| Cloudflare repeat | 3520 ms | 2812 ms | 3616 ms | 3545 ms |

The first Cloudflare navigation received an interim response at 851 ms but final
response headers only at 4377 ms. Reporting `navigation.responseStart` as the HTML
TTFB would therefore hide much of this delay: inspect `finalResponseHeadersStart`
when Early Hints are present. The navigation reported 1875 ms of `cfWorker` time;
the repeat reported 1301 ms. These header metrics do not describe full-body
completion. After the first HTML completed, cards took another 966 ms to become
visible. The same run had a 339 ms main-thread task and slow thumbnail and
analytics requests. These observations identify remaining server delivery and
browser work, but do not isolate one cause or prove the cache changes improved
end-to-end first-visit latency. All probe browsers were closed afterward.

A subsequent five-round HTTP comparison, after the browser visits had warmed the
site, produced these completion times. The first request is reported separately
and is not a controlled cold start:

| Response | Production first / median / slowest measured | Cloudflare first / median / slowest measured |
| --- | ---: | ---: |
| HTML | 1352 / 685 / 3660 ms | 2052 / 653 / 742 ms |
| Full RSC | 1023 / 452 / 596 ms | 435 / 278 / 702 ms |

All HTTP samples completed without server-render error digests. These warm
numbers must not replace the slow visible-load results above. The retained
changes reduce measured tag-validation work; BMAT202L's first-visit experience
still needs improvement. Browser reports are `bmat-browser-final-first.json`,
`bmat-browser-final-prod.json`, and `bmat-browser-final-repeat.json`; paired HTTP
samples are `bmat-clean-http.jsonl` in the ignored diagnostics directory.

The clean deployment passed alternating/concurrent synthetic A/B/anonymous
session isolation, chunked session cookies, CSRF uniqueness, and private/no-store
HTML and RSC checks. Streaming checks now include BMAT202L: nine concurrent
streams completed (maximum 2128 ms), cancellation did not break subsequent
visitors, and runtime prefetches contained rendered Flight rows.
Forced HEAD and GET revalidation also passed on all four routes; BMAT202L took
657 ms and 1242 ms respectively. App and Worker type checks and the OpenNext
build passed. Lint remains unavailable for the repository reasons noted above.
