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

## Follow-up: infrequent visits and dedicated tag Worker

The next pass used 75-second gaps between requests to BMAT202L. The benchmark's
new `--round-delay-ms` option makes this repeatable; it also records the response's
`Server-Timing` header. These are single-client measurements at MAA, with two
spaced samples per case, not p95 estimates or guaranteed cold starts.

| Case | Production spaced HTML | Cloudflare spaced HTML | Cloudflare initial request |
| --- | ---: | ---: | ---: |
| 60-second regional retention | 1327, 1256 ms | 2585, 2064 ms | 3304 ms |
| Revalidation-based regional retention | 1009, 1265 ms | 2256, 1642 ms | 5815 ms |

The retained `long-lived` regional-cache mode avoids discarding local copies
every minute. It uses each entry's revalidation lifetime (300 seconds for the
tested composable data); fallback shell retention follows the adapter default.
Tag checks remain enabled, including SWR invalidation, with the same five-second
regional metadata TTL. Background refresh remains enabled by the adapter.
This modest sequential comparison does not establish an end-to-end first-visit
improvement: the initial candidate request was slower. A workerd test confirms
retained data still becomes invalid when its tag changes.

### Tag-object activation remained the main delay

Tracing candidate `3b2e3469-f31e-40b4-820a-659e28ee7754` with longer retention
showed a 2162 ms internal response, with headers at 1623 ms. Its five initial tag
RPCs took 1338–1844 ms despite the earlier schema patch. Most page data reads hit
the regional cache. The schema patch alone had therefore not eliminated slow
tag-object activation.

The tag class now runs in `examcooker-test-tag-cache`, a 5.19 KiB Worker (1.67 KiB
gzipped), instead of sharing the approximately 35 MiB application Worker. It uses
the same pinned, patched OpenNext class. The state-preserving transfer migration
retains the existing namespace and invalidation rows. Existing bindings forward
to the transferred class; `wrangler.jsonc` now explicitly names the destination
Worker for subsequent deployments. The tag Worker has no HTTP deployment target
or application secrets. Tag Worker version: `d46a5025-6ed0-4c34-bdd2-a837fcbb1ac9`.

Only the tag Worker was deployed for the first comparison: the application build,
running application Worker, cache keys, and cached data stayed in place. The first
post-transfer trace completed in 730 ms, with headers at 290 ms. Its initial tag
RPCs took 205–260 ms. After a further 150 seconds without our page probes, the
first trace completed in 412 ms internally, headers at 211 ms, and 946 ms from the
client. Tag RPCs took 149–200 ms. This supports keeping the bundle separation;
the idle interval allows eviction but does not prove every object was evicted.
Forced regeneration still had a 2307 ms internal outlier and must not be described
as consistently subsecond.

Raw reports are `bmat-idle-short.jsonl`, `bmat-idle-long.jsonl`,
`bmat-trace-retention.jsonl`, `bmat-trace-split-tags.jsonl`, and
`bmat-trace-split-tags-idle.jsonl` in the ignored diagnostics directory. The
retention candidate changed only the mode literal in the two generated config
copies, with exact single-match assertions and original copies retained. This
kept the Next build/cache keys constant without another memory-heavy build.
Future normal builds take the setting from `open-next.config.ts`.

The regional-tag workerd test now runs the real dedicated Worker separately from
its caller and verifies invalidation across all six regions. Schema migration,
retained-entry invalidation, and app/Worker type checks also pass. Deployment and
local-preview scripts now include both Workers. Azure production was unchanged.

### Visible timing after tag separation

The clean app deployment was `94d634de-6f98-4b6b-8514-d8494ccc67de`; deleting the
temporary tracing secret activated `7b5ad4d6-f8c8-4e44-b586-cee86991b169` with the
same code. One fresh muted Chrome session visited BMAT202L on Cloudflare, then
production, then Cloudflare again. It used a verified regular Chrome user agent,
no request interception, and disabled media playback. It closed after capture.

| Visit | HTML complete | First contentful paint | 24 cards visible | Window load |
| --- | ---: | ---: | ---: | ---: |
| Cloudflare, fresh browser | 3206 ms | 2960 ms | 3252 ms | 4407 ms |
| Production, same browser | 1183 ms | 1148 ms | 1442 ms | 2149 ms |
| Cloudflare repeat | 576 ms | 208 ms | 619 ms | 593 ms |

The fresh Cloudflare result improved from the previous 6919 ms card timing, but
was still seconds long. Its final response headers arrived at 2556 ms and reported
792 ms `cfWorker` time; the repeat reported 77 ms. Network/client conditions vary
across these sequential runs; production was also faster than in the prior run.
Raw captures are `bmat-browser-split-{first,prod,repeat}.json` in the ignored
diagnostics directory. These are browser observations, not claims of a p95 bound.

### Rejected: another minification pass

Wrangler minification reduced the application upload from 35532.86 KiB to
24857.29 KiB (gzip: 7689.85 to 6879.54 KiB). Candidate
`d2321f7e-8317-43e8-874e-c50f789bdbc2` retained the same Next build/cache keys and
dedicated tag Worker. In another fresh-browser sequence, Cloudflare cards became
visible at 3641 ms initially and 2817 ms on repeat; production took 2564 ms.
Cloudflare's first HTML completed at 3393 ms and window load at 5276 ms. The repeat
HTML completed at 2786 ms despite the header reporting only 85 ms of Worker time:
that header is not a measurement of the complete streamed body. Client/network
conditions varied, and this did not demonstrate a visible-latency improvement.

Removed the minification setting and rolled the application back to
`7b5ad4d6-f8c8-4e44-b586-cee86991b169`. This version already has the external tag
binding and no diagnostic secret, so the rollback preserves the successful tag
transfer. The dedicated tag Worker remains on
`d46a5025-6ed0-4c34-bdd2-a837fcbb1ac9`. Raw rejected-candidate browser captures are
`bmat-browser-minify-{first,prod,repeat}.json` in the ignored diagnostics directory.
All probe browsers are closed. This pass demonstrates subsecond observations,
not a guarantee that every fresh visit or regeneration finishes below a second.

After restoration, live checks passed for synthetic session isolation (including
chunked cookies and anonymous CSRF tokens), complete/cancelled/concurrent HTML
streams, and runtime prefetches. BMAT202L completed in 552 ms during the streaming
check; the maximum across nine concurrent mixed routes was 2840 ms. Forced
BMAT202L revalidation completed in 451 ms for HEAD and 853 ms for GET.

Five subsequent paired samples were all valid. Warm HTML medians were 523 ms on
Cloudflare and 491 ms on production; full RSC medians were 419 ms and 859 ms.
Cloudflare's separately reported first requests were 485 ms HTML and 388 ms RSC.
These checks followed other traffic and are not cold-start measurements. Raw
rows are `bmat-split-final-http.jsonl` in the ignored diagnostics directory.
The two-Worker local preview started successfully and served a static asset with
HTTP 200, then was stopped. Its local tag configuration explicitly declares
SQLite because Wrangler's local migration parser does not infer the backend
from `transferred_classes`.

## Course catalog and paper data projections (2026-09-12)

The initial paired HTTP check reproduced a 5938 ms first `/past_papers` response
on Cloudflare versus 1447 ms on production. Three following warm Cloudflare
samples had a 452 ms median. BMAT202L's initial response was 1024 ms versus 287 ms
on production, with a 295 ms warm Cloudflare median. Warm medians concealed misses.
Raw rows: `.cloudflare-deploy/course-list-before.jsonl` (ignored).

Removed persistent `use cache` wrappers from cheap catalog projections, static
stats, paper sorting, filtering and pagination. Their source catalog/paper rows
retain the same tagged cache and lifetime. This reduces network cache operations
and filter-dependent cache entries without changing query/filter semantics.
Upcoming-exam caches now have stable keys; time-based expiry is applied after
reading cached rows and before pagination. This avoids forcing a new entry every
five-minute clock bucket. Scheduled expiry still uses the existing five-minute
cutoff, undated exams remain eligible, and additions/edits still invalidate the
`upcoming_exams` tag. The expiry regression check covers limits after filtering,
empty course groups, undated exams and non-mutation of the cached snapshot.

Before/after server traces of forced revalidation (two samples each):

| Route | Before server completion | After projections | Incremental writes before / after |
| --- | ---: | ---: | ---: |
| `/past_papers` | 2503 / 1655 ms | 1048 / 942 ms | 11 / 4 |
| `/past_papers/BMAT202L` | 745 / 663 ms | 297 / 281 ms | 13 / 8 |

These are forced regeneration measurements, not controlled empty-cache trials.
Raw traces: `list-trace-{before,projections}.jsonl` and
`bmat-trace-{app-before,projections}.jsonl` in `.cloudflare-deploy`.

The first BMAT request after the new build still took 5774 ms inside the Worker
(6147 ms client time). Its cache-lock acquisition calls took 1240 and 1224 ms;
R2 writes and lock release added further serial waits. This remains a real slow
observation, not a successful cold-load result.

Moved the unchanged `AppState` class to `examcooker-test-app-state` using a transfer
migration, preserving namespace `f10d6369cb704e6a94b2a4aa84734464`. Its first version
is `3eea9146-e926-4b7f-96e4-6d95dd8151a6`: 4.38 KiB upload, 1.53 KiB gzip, reported
startup 4 ms. Existing bindings forward after transfer; future app deployments
explicitly bind to the new script. The state regression checks now exercise the
actual separate Worker through RPC. All lock, rate-limit, expiry and vote tests
passed, as did the three-Worker local preview; the preview was stopped afterwards.

Five diagnostic probes creating new synthetic lock objects took 616, 998, 759,
682 and 746 ms for acquisition, including provisioning and persistence. These
are not a matched comparison against waking existing objects. The small bundle
removes application loading from this path; it does not make durable lock
creation sub-millisecond. Synthetic locks were released, with a 60-second expiry
as a fallback. The state Worker has no application secrets or public endpoint.

Fresh muted browser sessions (servers had received earlier probes):

| Route / visit | HTML complete | Cards visible | Production cards, same session |
| --- | ---: | ---: | ---: |
| Catalog, before | 857 ms | 1089 ms | 1116 ms |
| Catalog, projections | 593 ms | 832 ms | 1374 ms |
| Catalog, repeat | 686 ms | 530 ms | — |
| BMAT202L, projections | 779 ms | 1081 ms | 1005 ms |
| BMAT202L, repeat | 764 ms | 866 ms | — |

These browser observations precede the state transfer. They measure visible
anchors, not image completion or an interaction-ready p95. The catalog's first
window-load event still took 3411 ms. Browser sessions used a regular Chrome user
agent, muted/rejected media playback, no request interception, and were closed.
Raw captures: `list-browser-{before,projections}-{first,prod,repeat}.json` and
`bmat-browser-projections-{first,prod,repeat}.json` under `.cloudflare-deploy`.

Final clean-deployment verification: five warm paired requests gave full HTML
medians of 363 ms Cloudflare / 524 ms production for the catalog and 251 / 250 ms
for BMAT202L. Full RSC medians were 228 / 330 ms and 201 / 571 ms respectively.
All responses were complete and valid. The first catalog HTML request was still
3449 ms (2911 ms before headers), versus 1176 ms on production; the first BMAT
request was 362 / 273 ms. These do not establish consistent subsecond first loads.
Raw rows: `.cloudflare-deploy/course-final-http.jsonl`.

Separate fresh-connection curl probes negotiated HTTP/2. Cloudflare DNS/TCP/TLS
finished in 99–107 ms and full catalog responses took 602–757 ms, versus
812–1094 ms on production. This does not explain the earlier 3449 ms outlier; it
only establishes that fresh TLS connections were not inherently seconds long in
these subsequent samples.

The clean app passed A/B/anonymous session isolation, chunked cookies, distinct
CSRF tokens, complete/cancelled/concurrent streams, runtime prefetch and forced
HEAD/GET revalidation. Catalog forced GET took 1373 ms and BMAT 769 ms; the largest
of nine concurrent mixed routes was 2316 ms. Full Next/OpenNext build, app/Worker
typechecks, expiry checks and the separate-state Worker tests passed. OpenNext
reported copy warnings for four optional browser-launch dependency directories;
the completed bundle passed the deployed route checks. Lint remains unavailable
because this repository still uses removed `next lint` without an ESLint setup.
Temporary diagnostics and their secret were removed from the final deployment.

A later 75-second idle probe reproduced an outlier: catalog HTML completed in
573 ms on Cloudflare / 1091 ms on production, but BMAT completed in 6616 / 4023 ms.
This was retained in `.cloudflare-deploy/course-final-idle.jsonl`, not discarded.
Re-enabled the temporary server tracer to separate execution from delivery and
ran two more 75-second idle intervals with no other page probes. BMAT completed
inside the Worker in 241 / 190 ms, and at the client in 688 / 593 ms; paired
production requests took 1028 / 977 ms. No traced operation exceeded 150 ms in
the first idle request; the second had a 162 ms background R2 read. These runs
did not reproduce or explain the 6616 ms outlier, so consistent subsecond latency
is still unproven. Raw server traces: `.cloudflare-deploy/bmat-idle-trace.jsonl`.

Measured two public thumbnails through the existing `/_next/image` Cloudflare
Images path before considering any image-delivery changes. AVIF reduced 9199 /
10700-byte JPEGs to 3608 / 4529 bytes, but repeated optimized requests took
210–234 ms versus 101–116 ms directly from Azure. No image configuration or
component change was retained. Raw: `thumbnail-response-times.jsonl` in the
ignored diagnostics directory.

Live query checks also passed for an exact course search, an empty fuzzy search,
CAT1 filtering and two disjoint 24-card pages using recent-first ordering. An
initial supposed empty-search fixture contained the word "course" and correctly
returned 57 fuzzy matches; it was replaced with an actually unmatched query.
The clean candidate `076002e1-7a15-4445-b22a-f44eb2248c52` contains both external
Durable Object bindings. After the second tracing run, redeploying that same
clean code and deleting the secret also clears it from Wrangler’s latest saved
version metadata; a code rollback alone left it listed there.

Final active deployment: `40d8048d-dc69-430b-a3fc-7029a020c632`. Verified the live BMAT
HTML stream completes, the tracer is inactive, and `EC_PERF_TOKEN` is absent
from the Worker secret listing.

## September 13: remove public cache persistence from the response path

The first ordinary BMAT202L request in this pass took 3239 ms, followed by
163–278 ms requests. To reproduce the source-cache miss independently of idle
timing, a temporary authenticated diagnostic removed only BMAT202L's versioned
course-detail and paper-row payload entries from test R2 and the current regional
cache. Each sample seeded the entries, waited two seconds, removed those two
entries, then forced Next revalidation. The catalog, source database, tags and
namespace generation were not cleared. This is a controlled public payload miss,
not a completely cold Worker or a normal browser-navigation benchmark.

Three samples per stage, median milliseconds:

| Stage | Server headers | Server response complete | Client response complete |
|---|---:|---:|---:|
| Before | 1598 | 3422 | 3612 |
| Background payload persistence | 747 | 2079 | 2313 |
| Plus request-local reuse of pending public fills | 775 | 1854 | 2307 |

Before the change, both course metadata and paper rows waited for R2 persistence
and lock release after their loaders finished. Those operations accounted for
roughly 1.7–2 seconds in the controlled traces. Cloudflare now registers that
write-and-unlock chain with `ctx.waitUntil`, returning loaded data immediately.
The producer retains ownership of the lock until persistence finishes; followers
still wait for the fill. Loader failures release the lock, failed writes are
recoverable, and Node/Redis retains synchronous persistence. If lifetime
registration throws, the request waits for persistence and cleanup instead.
Cloudflare permits HTTP background work for up to 30 seconds after the response;
the existing 15-second lock expiry remains the termination backstop. See
[Cloudflare's context documentation](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil).

The first candidate exposed one extra R2 read when Next rendered the course
metadata again before its background write finished. The final candidate reuses
that loaded public value within the same execution context. A WeakMap holds only
strings and expiry timestamps, keyed by context and origin-qualified versioned
public key. It does not share promises or values with other requests. Failed
writes and deletions remove local values; expiry and generation changes bypass
them. All three final traces eliminated the extra read (four application R2 reads
versus five in the first candidate). The small sample shows a further 225 ms
server-median reduction but effectively no additional client-median improvement;
do not attribute a precise end-to-end gain to this second change.

The combined server median fell 46%, and the controlled client median fell 36%.
Final server samples were 1796–2096 ms: fully missing public payloads still exceed
one second. Remaining traces include R2 reads and two serial lock acquisitions
of roughly 300–490 ms each. These results do not establish consistent subsecond
cold loads. Raw local traces: `surface-miss-before.jsonl`,
`surface-miss-deferred.jsonl`, and `surface-miss-deferred-local.jsonl` under the
ignored `.cloudflare-deploy/` directory.

Validation covers concurrent fills, failed persistence, invalidation during a
fill, Node behavior and failed lifetime registration. The real regional cache
test additionally checks request/origin separation, generation changes, expiry,
failed writes and rejection of session/state keys. Next/OpenNext production
build and both app/Worker typechecks passed. OpenNext still reports the previously
documented optional browser-launch dependency copy warnings.

On the clean final deployment, three warm paired samples gave these complete
response medians (Cloudflare / production): BMAT HTML 282 / 700 ms, catalog HTML
295 / 444 ms, BMAT RSC 146 / 221 ms, and catalog RSC 221 / 341 ms. First requests
were recorded separately: BMAT HTML 3008 / 1242 ms and catalog 1109 / 4519 ms.
Production also had warm outliers of 4368 ms BMAT HTML and 9673 ms catalog RSC.
No samples were discarded. Raw rows: `deferred-final-http.jsonl`.

Fresh headless browser sessions (media disabled) showed BMAT's 24 cards at
1800 ms initially and 678 ms in a fresh-session recheck, compared with production
at 1020 / 1440 ms. Repeat Cloudflare visits were 781 / 775 ms. The first slow
browser response delivered HTML at 990 ms but a stylesheet and font finished
around 1717 ms; visible content followed. A diagnostic HTTP/2-only browser showed
cards at 703 / 534 ms, but the normal-settings recheck also fell below a second.
There is no isolated evidence that HTTP/3 caused the first outlier, so no transport
setting was changed. Browser server caches were not forcibly cleared. The course
list showed 12 cards at 1152 ms initially / 572 ms on repeat, versus production
822 ms. All browser runs closed their sessions and reported no page errors.

The deployed app passed alternating/concurrent/chunked A/B/anonymous session
isolation, distinct CSRF tokens, private HTML/RSC response headers, nine concurrent
streams (maximum 1245 ms), response cancellation and runtime prefetch. Forced
HEAD/GET revalidation completed on all four tested routes; BMAT forced GET was
726 ms with its public payloads present. Exact/empty catalog search, CAT1 filtering
and disjoint 24-card pagination passed. Temporary diagnostics were removed, the
old token returns ordinary complete HTML, and `EC_PERF_TOKEN` is absent from
Worker secrets. Final active Worker version: `c98b47ea-ef9e-416a-b665-f0327fe1c1f2`.

After more than 75 seconds without further page probes, BMAT's complete HTML
took 426 ms on Cloudflare versus 901 ms on production; the immediate repeats
took 241 / 277 ms. This single idle check passed, but does not negate the recorded
3008 ms first request after deployment. Raw: `deferred-final-idle.jsonl`.

## September 13: reuse the shared catalog for course details

The course page previously fetched its metadata/counts through a dedicated
course-detail cache, then fetched the shared catalog to populate title variants.
The catalog already contained all the required fields. `getCourseDetailByCode`
now projects from the tagged catalog rows instead of maintaining another cache
entry and performing a separate SQL lookup and two count queries on a miss.
The shared catalog retains the existing tags and lifetimes. Its payload key is
now `course-catalog-rows-v2`, with original database aliases stored separately
from generated search acronyms so course-detail output remains unchanged.

Repeated the same test-only reset of BMAT202L's course-detail and paper-row
payload entries, followed by forced Next revalidation. The shared catalog was
seeded before each reset in both stages. The removed course-detail key becomes
unused in the candidate; the diagnostic locates BMAT's ID in the new catalog
after that old entry is gone. It still deletes only the two course-specific
payload keys. This models a cold course with a warm shared catalog, not a wholly
cold site or Worker.

Three samples per stage, median milliseconds:

| Stage | Server headers | Server response complete | Client response complete |
|---|---:|---:|---:|
| Previous deployed code | 737 | 1748 | 2126 |
| Shared course metadata | 54 | 834 | 1101 |

All three candidate server samples were below one second: 939, 834 and 747 ms.
The server median fell another 52%, and the client median fell 48%. Application
R2 misses fell from four to two per response, and lock acquisitions fell from two
to one. The remaining paper-row miss and lock are real work; these measurements
do not imply every browser load completes in 834 ms. Raw traces are retained in
`surface-miss-shared-catalog-before.jsonl` and
`surface-miss-shared-catalog-after.jsonl` under `.cloudflare-deploy/`.

The focused test exercises the actual catalog code and public cache helper with
controlled database rows. Concurrent detail, title-variant and search readers
share the three catalog queries. It verifies normalization, exact original
aliases, derived search aliases, zero-count courses, unknown courses and updated
counts following invalidation. Next/OpenNext production build and app typecheck
passed, with the previously documented optional dependency copy warnings.

### Remove the redundant Cloudflare paper-row cache layer

The intermediate clean deployment still recorded a 3314 ms first BMAT HTML
request, despite a 279 ms warm median. Its first catalog request was 1765 ms;
warm median 373 ms. Raw: `shared-catalog-final-http.jsonl`. Removing the duplicate
course metadata lookup had not eliminated first-request outliers.

The paper-row loader itself also sat under two persistent caches: Next's tagged
`use cache` entry and the older public surface-cache facade. On Cloudflare it now
loads through Hyperdrive directly when Next's cache misses. Next retains the same
`past_papers` tag, five-minute revalidation and one-hour expiry, including its R2
and regional cache backends. The Node path retains the original surface-cache
key and locking behavior. Other public payload caches and application-state
locks are unchanged.

With the shared catalog warm and forced Next revalidation, the same three-sample
probe measured server completion at 157 / 187 / 171 ms and client completion at
519 / 654 / 470 ms. Median server time fell from 834 to 171 ms; client time fell
from 1101 to 519 ms. The final trace has no paper payload R2 reads or application
cache-lock acquisition. Raw: `surface-miss-next-only-papers.jsonl`. This is still
a controlled Next cache miss with shared catalog state present, not a cold site.

An ordinary traced first request immediately after deployment took 1605 ms in
the Worker and 4039 ms at the client. A 720 ms R2 read for the persisted page
shell and subsequent sequential Next cache reads remained. This explicitly
preserves evidence of the remaining first-request problem, rather than treating
the 171 ms controlled result as a promise for every visitor.

Six concurrent forced revalidations returned complete pages, with client times
1207–4426 ms. A separate traced burst completed inside the Worker in 248–2021 ms
and at the client in 2600–2771 ms. A follow-up log capture confirmed Next R2 cache
write throttling (`10058`) and cache-warming warnings under forced concurrency;
one paper query took 1524 ms and an upcoming-exam query 1430 ms. R2 limits
[overlapping writes to the same key](https://developers.cloudflare.com/r2/platform/limits/)
to one per second. These are limitations of the tested burst, not a clean
subsecond concurrency result. The removed inner lock no longer deduplicates
paper SQL fills across cold requests; warm requests still use Next's cache.
Raw: `next-only-first-page.json`, `next-only-concurrent.json`, and the protected
`next-only-tail.jsonl` in `.cloudflare-deploy/`.

The runtime comparison test checks identical paper/filter data on Node and
Cloudflare and confirms that only Node invokes the extra cache. Both production
builds and the focused shared-catalog/runtime tests passed.

Final clean browser verification deliberately ran before the HTTP warmups. BMAT
cards appeared at 3627 ms on the fresh session, versus 5832 ms on production;
the Cloudflare repeat showed cards at 697 ms. The first Cloudflare navigation
reported `cfEdge=1778`, `cfWorker=746`, headers at 2915 ms and HTML at 3378 ms.
These metrics and the controlled cache-miss trace measure different scopes;
do not add edge and Worker timings or attribute all delay to SQL. Cloudflare
describes its [edge processing interval](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/cf.timings.edge_msec/)
as excluding client network transfer and exposes
[Worker execution including subrequests](https://developers.cloudflare.com/changelog/post/2026-02-18-cfworker-server-timing/)
separately. The exact cause of the first-load edge delay is not established.
All browser sessions were headless, media-disabled and closed after measurement.

Subsequent paired HTTP samples (three per route/type) gave median complete
responses of 205 / 294 ms for BMAT HTML, 309 / 549 ms for catalog HTML,
353 / 568 ms for BMAT RSC, and 260 / 450 ms for catalog RSC (Cloudflare /
production). The separately recorded first HTTP requests were 733 / 877 ms
for BMAT HTML and 408 / 655 ms for catalog HTML. Those are after the browser
visits and must not be labeled cold. Raw rows: `next-only-final-http.jsonl`;
browser records: `bmat-browser-next-only-final-*.json`.

The final deployment passed A/B/anonymous and chunked-cookie session isolation,
CSRF uniqueness, private HTML/RSC response policy, nine normal concurrent streams
(maximum 1287 ms), cancellation recovery, runtime prefetch, forced HEAD/GET
revalidation, exact/empty search, CAT1 filtering and disjoint pagination. BMAT's
forced GET completed in 501 ms in the clean verification. Diagnostics and their
secret were removed; the old token returns ordinary complete HTML. Active Worker
version: `88494813-87a6-40b4-9c38-b6a9616dbc4f`. Azure production was not redeployed.
