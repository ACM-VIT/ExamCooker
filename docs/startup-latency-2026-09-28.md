# September 28 latency investigation

PostHog's eligible, non-synthetic anonymous traffic in India, September 27
10:05–22:05 UTC, still shows a Cloudflare home-page disadvantage:

| Home-page measurement | Azure | Cloudflare |
| --- | ---: | ---: |
| Desktop navigation TTFB median | 800 ms (349 samples) | 1363 ms (301 samples) |
| Mobile navigation TTFB median | 1108 ms (171 samples) | 1950 ms (172 samples) |
| Origin response p75, all devices | 278 ms (902 samples) | 1343 ms (853 samples) |

Neither home-page cohort recorded a server 5xx in this window. Desktop PDF first
paint remained better on Cloudflare (2319 ms versus 2990 ms median), while the
small mobile PDF cohorts remained around five seconds. The rollout's PDF/vitals
measurement version 2 excludes later SPA navigation and background-tab time.

## Changes retained

- Restrict the Next Node proxy to paths ending in `/create` and the two native
  association endpoints. Other requests only acquired an unused `x-url` header.
  Upload rate limiting remains in place; authorization continues in its existing
  application handlers. Matcher tests cover trailing slashes and nested paths.
- Add `x-ec-worker-first-request` and `x-ec-worker-version` to application Worker
  responses. The rollout router records these as `worker_first_request` and
  `worker_version` on `ec_cutover_request`. Older Workers have an unknown/null
  marker; Azure requests do not acquire this classification. First request means
  the first invocation of a Worker isolate, not a first-time visitor or a cold
  data cache. Static assets served without invoking the Worker do not count.

These fields allow subsequent production comparisons to separate startup from
later requests within each route/device/country cohort. They do not measure CPU
time, and are not themselves proof that startup causes every slow request.

## Experiments

Instrumented ec-test requests showed fast warm requests alongside expensive
first invocations and occasional remote tag/R2 waits. The original Singapore
sample had median Cloudflare Worker/edge timings of 506/738 ms for three first
invocations, versus 115/10 ms for five later invocations. Local trace durations
omit some CPU time because the Workers clock advances around I/O; they must not
be presented as full end-to-end durations.

The proxy-only results were mixed. Retaining the smaller execution scope does
not establish a population-level speedup. Two final-bundle minification variants
reduced uploaded JavaScript size, but did not improve first-invocation timings
consistently. Both were rejected; production minification settings are unchanged.
Function-name preservation was checked because PPR resume state depends on it.

[Measurements](benchmarks/startup-latency-2026-09-28.json) retain every measured
region, including slow US-edge outliers. Each stage used three rounds across
home, BMAT202L, and the BMEE209L paper with 6.1 seconds between requests. These
sequential small samples vary in isolate and cache state; they are not controlled
cold starts, browser paint measurements, or evidence of a universal speedup.

The 50% anonymous rollout, private HTTP response policy, public-data cache
lifetimes, and cross-backend paper invalidation remain unchanged.

Validation: typecheck, proxy/rollout tests, all 28 built PPR payloads, Worker
bundle checks, and the signed cross-backend invalidation test pass. The final
ec-test deployment passes session/CSRF isolation, concurrent and canceled
response streams, RSC prefetch, native association endpoints, and upload-route
checks. A muted headless browser exercises home/papers/notes searches without
browser errors; search responses take 7–15 ms once initialized. Those smoke
timings are not a before/after speedup claim. Lint remains unavailable under the
repository's current Next 16 setup.
