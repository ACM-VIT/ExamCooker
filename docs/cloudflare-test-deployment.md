# Cloudflare test deployment

The root Wrangler configuration deploys `examcooker-test` to
https://ec-test.acmvit.in using Next.js 16.3.5 and OpenNext 1.20.6. This is a test
of the existing app against the production database and services. The original
Azure production deployment remains in service. The command-agent Worker has its
own configuration under `worker/`.

## Runtime and storage

- OpenNext handles PPR and Cache Components. R2 `examcooker-test-next-cache` holds
  the incremental cache; Durable Objects handle revalidation and cache tags.
  `enableCacheInterception` stays false so dynamic PPR boundaries resume through
  Next.js. A short-lived regional data cache avoids repeated R2 reads; regional
  public tag metadata is cached for up to five seconds. Tag shards are replicated
  across six regions; reads select the visitor's region and writes update every
  replica. Personalized HTTP responses are never in that cache.
  The Next.js Node proxy remains an experimental OpenNext integration.
- Public paper/course payloads and generated PDF Markdown use the private R2
  bucket `examcooker-test-app-cache`. Expiry metadata governs reads. A 31-day
  lifecycle rule removes old payloads; cache misses regenerate normally.
  Versioned public paper/course payloads also use the regional Cache API for up to
  60 seconds, bounded by their R2 expiry. Content edits increment the authoritative
  DO namespace counter, producing new cache keys. Sessions, locks, counters,
  votes and unversioned Markdown entries cannot use this regional cache.
  Optional paper-sibling lookups explicitly cache a successful `null` result;
  primary resource misses and failed database requests remain uncached.
- `AppState` Durable Objects replace Redis for this Worker: atomic sliding-window
  rate limits, expiring generation/cache locks, namespace counters, and PDF
  feedback. Each feedback generation and all of its voter keys share one object.
  Synchronous SQLite transactions preserve atomic updates; alarms remove expired
  records. R2 and these objects have no public HTTP endpoint.
- No Redis connection, Azure connector, private tunnel, or VM is needed by the
  test Worker. Existing Node/Azure instances retain their Redis backend until
  production cutover. Test caches and feedback are separate from production
  Redis; historical Redis feedback must be migrated before retiring production.
- CockroachDB Cloud is unchanged: AWS Mumbai (`ap-south-1`), database `defaultdb`.
  The `HYPERDRIVE` binding connects through `examcooker-test-db`, with SQL response
  caching disabled and a soft origin connection limit of 10. Worker database
  clients remain scoped to each request; Hyperdrive reuses origin connections.
  Node/Azure continues using `DATABASE_URL` directly. Static OG assets use the Workers asset
  binding instead of runtime filesystem reads.
- PDF/WASM/Markdown and video-player libraries load through `next/dynamic` inside
  Client Components with `ssr: false`. They require a browser; keeping them out of
  the Worker reduced its upload from about 55 MB to 35 MB. Cache Components stays
  enabled. This is separate from the unsupported route-segment `dynamic` export.

## Authentication and cache boundaries

`auth()` uses React `cache()` for request-local memoization. It reads the current
request's cookies and checks that JWT's user against the database. It is not a
shared Cache Components function. Shared `use cache` functions are confined to
public course/resource data; PDF feedback attaches the current voter's vote after
reading a shared result. Never move cookie/session reads inside a shared cache.

`cloudflare/worker.ts` retains OpenNext's request context and streaming handler.
Its response policy sets `private, no-store` plus CDN no-store headers for HTML,
RSC, auth/API/moderator/native-auth routes, requests with cookies or Authorization,
responses with Set-Cookie, and mutations. Immutable static assets remain cacheable.
This deliberately caches public **data and PPR shells**, while personalized HTTP
responses execute for every request. Do not enable a zone-wide Cache Everything
rule or outer Workers Caching for this app. Wrangler explicitly sets
`cache.enabled: false`. Zone rules that override origin cache
headers must exclude this hostname; the current Wrangler OAuth token cannot read
zone rulesets/Page Rules, so that dashboard setting cannot be audited with it.

The test hostname is explicitly allowed by the app's auth-origin validation.
Azure Blob Storage allows the test origin to read PDFs with GET/HEAD/OPTIONS on
both the configured development storage account and the production asset account.
Google and Apple provider registrations must also allow its callback URL. The
existing production cookies are host-only; the test site signs in separately.

## Secrets and deployment

Production app settings and the deployed `.env` were merged into a protected,
ignored `.cloudflare-deploy/secrets.json` and uploaded as Worker secrets. Only
`NEXTAUTH_URL` and `NEXT_PUBLIC_BASE_URL` were changed to the test hostname.
Additional Azure service-principal credentials allow the existing read-only
Azure metrics dashboard to function outside Azure. They are not used for Redis.
Never commit the populated file, tokens, publishing profile, or build logs.

Public `NEXT_PUBLIC_*` variables must also be present during the build, because
Next.js embeds them in client bundles. Keep build values aligned with runtime
values. Redis can be disabled in the local build environment; the Worker uses its
native bindings regardless of the retained production Redis environment values.

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm exec tsc -p cloudflare/tsconfig.json
node scripts/cloudflare/test-state.mjs
node scripts/cloudflare/test-regional-public-cache.mjs
node scripts/cloudflare/test-regional-tags.mjs
node scripts/cloudflare/test-incremental-retention.mjs
node scripts/cloudflare/test-optional-cache.mjs
node scripts/cloudflare/test-pending-cache.mjs
node scripts/cloudflare/test-scheduler.mjs
pnpm cf:build
node scripts/cloudflare/test-ppr.mjs
pnpm cf:deploy
# AUTH_SECRET must be supplied securely; the script never prints it or JWTs.
node scripts/cloudflare/test-auth-isolation.mjs
node scripts/cloudflare/test-render-streams.mjs
node scripts/cloudflare/test-revalidation.mjs
node scripts/cloudflare/compare-response-times.mjs
```

`pnpm cf:deploy` deploys the small tag-cache and app-state Workers first, then the application.
`wrangler.tag-cache.jsonc` owns `examcooker-test-tag-cache`; the application's
`NEXT_TAG_CACHE_DO_SHARDED` binding refers to that script. Its initial transfer
migration preserves the existing tag namespace and stored invalidation data from
`examcooker-test`. Do not replace this transfer with a new/delete migration.
The tag Worker has no public route, workers.dev endpoint, or application secrets.
Its source imports the same pinned and patched OpenNext tag class used by the app.

`wrangler.app-state.jsonc` similarly transfers the existing `AppState` namespace
from `examcooker-test` to `examcooker-test-app-state`. The app's `APP_STATE` binding
must reference that script on future deployments. The class implementation,
object names, locks, counters, limits and vote data are preserved. This Worker
also has no public route, workers.dev endpoint or application secrets.

`pnpm cf:preview` populates the local cache and starts all three Workers in one Wrangler
process. It preserves OpenNext's setting that prevents Wrangler from loading
`.env` independently. Supply local bindings/credentials as before. The regional
tag test exercises the actual separate Worker through cross-Worker bindings.
Preview uses `wrangler.tag-cache.local.jsonc` and `wrangler.app-state.local.jsonc`
to declare fresh local SQLite storage: Wrangler 4.130 does not infer the storage type from a transfer migration.
Deployments must use the corresponding non-local configurations, which preserve remote state.

To reverse the ownership transfer, deploy a new transfer migration on the
application Worker from the corresponding tag-cache or app-state Worker, then change its binding back
to the local class. A code-version rollback alone does not reverse a Durable
Object migration. Keep the current external binding when rolling back unrelated
application code. See Cloudflare's
[transfer migration documentation](https://developers.cloudflare.com/durable-objects/reference/durable-object-class-migrations-legacy/#transfer-migration).

Wrangler's Hyperdrive `localConnectionString` points to the documented local
PostgreSQL development database; it is ignored in deployment. For a different
local preview database, securely set
`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`. Never put production
credentials into `wrangler.jsonc`. Hyperdrive origin credential rotation is
separate from changing the Worker's `DATABASE_URL` secret.

See [the measured optimization results](cloudflare-performance.md) for the later
latency comparison across course, paper, notes and syllabus pages. The comparison
script supports `--rounds`, `--mode html|rsc|both`, comma-separated `--paths`,
`--round-delay-ms` for spaced visits, and `--output`. It reports the first request
and slowest measured response separately and validates response bodies so an
error page cannot be counted as a fast successful response.

On the current workstation the global pnpm shim points to a missing installation;
use a working pnpm 12.3.4 installation on `PATH`, including for OpenNext's nested
`pnpm build` and Wrangler commands. `pnpm lint` still invokes the removed `next lint`
command; no standalone ESLint configuration exists in this repository.

## Remaining Azure exit work

Moving the web app and Redis responsibilities does not move Azure Blob assets or
the upload/PDF processing services. Their existing URLs and production environment
values are preserved for this test. Before shutting down Azure, copy and verify
assets in R2, migrate upload/processing services, update storage URLs and the
Azure-specific monitoring view, transfer Redis feedback, then perform a separate
production cutover. Do not delete production infrastructure based on a successful
test deployment alone.

## Validation (September 12, 2026)

Live Worker version: `da7bbc7d-21b6-4ebc-b944-91874b3be51e`.

The OpenNext production build, application/Worker typechecks, Worker-runtime
concurrency/expiry tests, and live A/B/anonymous session isolation and CSRF probes
passed. All nine concurrent HTML streams completed, as did requests after canceled
streams and forced HEAD/GET revalidation of all three public landing pages.
Runtime prefetches for the home page, notes, and BCSE102L returned rendered Flight
rows. The PDF browser check rendered both pages without a viewer error.

Three paired warm requests per route from this workstation produced these median
times in milliseconds. Complete HTML transfer includes streamed server content;
it does not measure browser interactivity or PDF/WASM startup.

| Route | Azure first byte | Worker first byte | Azure complete HTML | Worker complete HTML |
| --- | ---: | ---: | ---: | ---: |
| `/` | 141 | 221 | 1,737 | 1,390 |
| `/past_papers` | 203 | 242 | 1,025 | 732 |
| `/notes` | 310 | 302 | 3,304 | 488 |

All measured responses completed with HTTP 200 and no server-error digest.
Cloudflare served them through Chennai (MAA). This is a small warm sample; the
first home-page request after deployment still took about 5.7 seconds. There is
no claim that Workers always has lower first-byte latency or faster cold starts.
The final live trace also contained a cache-warming warning on `/past_papers`
while the response completed successfully. Keep this deployment as a test and
review that warning and cold-start behavior before any production cutover.

Google rejects the new callback with `redirect_uri_mismatch`; registration
of `https://ec-test.acmvit.in/api/auth/callback/google` is intentionally deferred.
The app generates that correct callback URL. No full Google/Apple login was
completed. The copied command-agent Workers hostname does not resolve, causing
WebSocket retries; that existing environment dependency was preserved. Azure Redis
feedback remains in production and was not erased.

PPR requires `experimental.maxPostponedStateSize: "5mb"`: Next's default uses
a 500 MB zlib inflation limit, which Workers rejects against its 128 MiB maximum
even when inflating a tiny payload. The configured limit permits up to 25 MiB
of decompressed resume data. The PPR test inflates every built resume payload
inside workerd to catch regressions.

The pinned OpenNext dependency has a pnpm patch for Next.js 16.3 compatibility.
Its staged-render scheduler and module-load tracking changes are adapted from
[OpenNext PR #1318](https://github.com/opennextjs/opennextjs-cloudflare/pull/1318),
head `6b783939aefa8f9a19d4f002f68bc57c62879098` (MIT licensed). This is still an
unmerged upstream fix, so the dependency patch remains a maintenance obligation.
It replaces Node event-loop assumptions with request-scoped workerd scheduling.
Additional fixes preserve component names recorded by React's PPR build, disable
Next's cross-request sharing of unfinished cache streams, and let the ISR queue
recognize successful PPR revalidation through `x-nextjs-postponed: 1`. Next omits
`x-nextjs-cache` for those partial shells; a local R2 inspection confirmed that the
authenticated HEAD request still replaced the cached object. Completed public
payloads remain shared in R2. `pnpm install --frozen-lockfile` applies these changes;
do not remove them without repeating rendering, cancellation, revalidation, and
session-isolation probes on the actual deployed Worker.

The OpenNext AWS adapter also has a pnpm patch: pending composable-cache streams
are scoped to their Worker request, and remain readable until the persistent
write finishes. This avoids sharing request-owned I/O and a read-before-write
race during cache warming. The regression probe uses the actual adapter in
workerd with twelve overlapping writers.
