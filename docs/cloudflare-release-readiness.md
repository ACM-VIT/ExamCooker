# Cloudflare production candidate — 21 October 2026

Base: main `5bb83b3cdc5df1bb8a45bcd69e08037d18ce755e`. This candidate combines the ec-test PDF fixes with request-local tag-read coalescing and the Next 16.4 manifest compatibility fix. It requires no database migration, new secret, or rollout-percentage change.

## Included behavior

- Recover a failed PDF blob-image decode through the existing bounded low-resolution retry, using an abortable inline image; keep terminal errors observable.
- Preload saved-edit support on paper intent and retain the single PDF/WASM transfer contracts.
- Measure client paper opens through visible decoded pixels, with paired failure and abandonment outcomes; count recovered inline images in document-load RUM.
- Recognize UUID paper routes and share pending tag reads within each request. Release shell reads without waiting for unrelated data shards; retain normal Next invalidation.
- Inline Next 16.4 preview props, preserve the native scheduler when Next installs its timer tracker, retain the complete workspace lockfile, and run the new contracts in CI with the pinned pnpm version and submodule checkout.
- Use ordinary Worker packaging on ec-test, matching the production canary.

## Production state and release boundary

Live readback at 08:57 UTC (14:27 IST) on October 21 confirmed `examcooker-canary` served version `8fde73d8-c26a-4e67-990c-0794cce5347b`. The router `examcooker-rollout` had `CF_PERCENT="50"` and bound `CANARY` to `examcooker-canary`. This percentage applies to new anonymous browsing sessions. Signed-in traffic, APIs, uploads, moderation, and MCP remain on Azure.

Production promotion is separate from this ec-test validation. A production build must use production public/base/auth URLs and fresh output generated with `wrangler.canary.jsonc`. Never reuse test `.next`/`.open-next` output. Build-time values cannot be corrected by changing Worker secrets afterward.

The ec-test candidate deliberately omits browser source maps and does not upload application source to PostHog. A production release should use the existing approved CI source-map path, verify its upload, and confirm no `.map` files remain in public assets. The local candidate is not evidence that this external upload ran.

## Verified candidate and remaining limits

The active ec-test Worker is `61001490-f5d8-4057-ba70-77fc67cff3f2` at 100%, with browser build `WBG4lW9CZ_W04KXfnqlqz`. This is the fixed candidate; the earlier failing rebuild was rolled back before this version was deployed. Production was not deployed during this work.

- Live ec-test: independent A/B/anonymous sessions and CSRF, chunked cookies, private/no-store responses, complete HTML and RSC, nine concurrent streams, cancellation recovery, and runtime prefetch passed.
- Real browser: edited and unedited papers rendered without JavaScript errors; the saved 90-degree rotation remained intact. Revoking both rendered blob URLs forced the inline recovery path, which also displayed a decoded rotated page without terminal errors.
- Local contracts: 18 PDF unit checks, seven RUM checks, five browser recovery scenarios, 14 navigation-journey contracts, actual PDFium pixels/transfer counts, six-region invalidation, request-local tag coalescing, and Next's real immediate tracker passed. The scheduler and shell-gating regressions also failed under their respective negative controls.
- Fresh test and production-configured Next/OpenNext builds, TypeScript checks, 28 built PPR payloads, Worker bundle assertions, resume-cache seeding, and the canary deployment dry run passed. The canary package is preparation evidence; promotion must rebuild the reviewed commit. The build-time course-data refresh was excluded from source changes.

Cold-start improvement is not established. Eight direct probes completed with no render digests: two first-invocation header times were 1.55–3.86 seconds; six subsequent observations were 0.17–0.55 seconds. Separate cold browser opens took 5.88 seconds (plain) and 10.02 seconds (edited) to show the PDF. These are small, unmatched ec-test samples, not production percentiles or a before/after comparison. Keep the rollout at 50%.

`pnpm lint` cannot run because the repository invokes the removed `next lint` command. GitHub-hosted contracts and the approved production source-map upload must be verified independently; local passes do not prove either. A local full-stream run lacked a configured database and failed on the papers index; the same live ec-test stream suite passed.

## Build connection

Workers Builds targets `examcooker-canary`, using `pnpm cf:build:canary` and
`pnpm cf:upload:canary` for main and release branches. The latter uses OpenNext's
upload command to populate the build-specific R2 cache and upload a Worker
version. It does not activate that version, alter router traffic, or apply a
Durable Object migration. The existing canary already has migration `v1`.

The legacy `examcooker` triggers are retired by excluding all branches, preserving
their settings for reference. Its old main command built plain Next output, and
its branch command tried to upload ec-test's migrations to a different Worker.
Do not reactivate those commands or force an unrelated migration to clear a check.

Build secrets are provisioned from the repository's existing approved CI secrets
using the manual `Configure canary build secrets` workflow. It requires a temporary
account-scoped Workers CI Read/Write token stored as `CF_BUILDS_SETUP_TOKEN`.
Revoke the token and remove that GitHub secret after setup or rotation. No
runtime Worker secrets are changed by this workflow. Browser telemetry and
source maps share revision resolution: GitHub SHA, Workers CI SHA, Vercel SHA,
then the local Git revision. Builds with source-map upload refuse an unknown
revision. The current `exam-cooker-2024` Vercel account block is separate from
this Cloudflare path; the development preview is healthy.

## Promotion sequence

1. Review and merge the source changes, including the lockfile and adapter patch. Require the PDF performance contracts and normal build checks.
2. Build each target fresh from the reviewed revision. Azure's existing main workflow deploys the shared client fixes. Workers Builds prepares the Cloudflare canary version with production URLs and `wrangler.canary.jsonc`; verify its build, source maps and uploaded version before activation.
3. Deploy the canary application and the router's small inline-image RUM correction together. Preserve `CF_PERCENT="50"`, existing secrets, service bindings, and cohort-cookie behavior. No tag-cache Worker schema change is required by the new read-coalescing patch.
4. On the production hostname, use the existing synthetic probe mechanism to verify both backends: public documents and RSC, real edited/unedited PDFs, saved rotations, assets, private/no-store handling, and build/version attribution. Confirm ordinary authenticated/API traffic still routes to Azure.
5. Compare complete post-deployment windows by backend, build, country, device, route, and first/later Worker invocation. Report failures and missing journey outcomes alongside p50/p75/p95. Do not increase the assignment percentage based on the local overlap contract or a handful of ec-test navigations.

## Rollback

For an ec-test regression, restore its previous clean Worker version `9691ec08-3177-444a-9eed-c0712614d196`. Retain existing assets and build-specific cache entries so old tabs continue to work.

For a production regression, restore the previous canary version recorded immediately before promotion. If traffic must return to Azure, deploy the router with `CF_PERCENT="0"`; this overrides existing assignments. Keep the router installed to handle old tabs and build affinity. Preserve the previous router version and Azure deployment as independent rollback targets. See `docs/cloudflare-rollout.md` for the existing commands and synthetic checks.

No database or storage rollback is needed for these changes. Do not purge shared public data or rotate cohort/auth secrets as part of an application rollback.
