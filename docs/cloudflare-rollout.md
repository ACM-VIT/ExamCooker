# Production Cloudflare canary

Production remains at `https://examcooker.acmvit.in`. Its proxied CNAME still
targets `examcooker-2024.azurewebsites.net`; the `examcooker-rollout` Worker
selects Azure or the `examcooker-canary` service binding.

The current target is **50% of new anonymous browsing sessions**, not 50% of all
requests. Assignment occurs on a public document navigation and stays in a
signed, Secure, HttpOnly, host-only cookie for 24 hours. Bots, speculative
prefetches, and existing tabs without a cookie do not enroll. Signed-in users,
auth, APIs, uploads, moderation, MCP and PostHog's existing proxy stay on Azure.
The `exam-cooker.acmvit.in` alias is outside this initial rollout.

Initially enabled at 5% on 2026-09-27 at approximately 01:15 UTC (06:45 IST). Initial router version:
`7b945fdd-ded2-4b5e-9751-7e516db0371c`. Production-host probes verified both
backends, visible PDFs, RSC affinity, Azure session APIs, immutable chunk
fallback, blocked mismatched Server Actions, and PostHog ingestion. Seven
policy/signature tests and the router typecheck passed. The first report had
only four eligible Azure documents and no real Cloudflare sample; it cannot
support a performance comparison yet.

Raised to 50% on 2026-09-27 at the user's request. Existing 24-hour assignments
remain unchanged; the new percentage applies as new visitors enroll or their
assignment cookies expire. Signed-in traffic and APIs continue to use Azure.
The 50% router version is `05a6f636-43f7-4580-be71-045712c4d1b5`.

Reload-loop fix: version `9b5e8e6d-bdf8-41f3-8a6a-aed84e083f91` retains 50%.
Prefetching the Azure-only upload link from a Cloudflare page previously
triggered a reload of the current page, which repeated the same prefetch.
Mismatched GET/HEAD requests now return an uncached 409 without a reload header.
Next treats these as unavailable prefetches and performs a full destination
navigation when needed. Mismatched writes remain blocked and are never replayed.
The fix deployed at 01:37:50 UTC. The comparison report excludes measurements
before 01:40 UTC because the reload loop inflated document and error counts.

`ec-test.acmvit.in` remains independent. Canary uses its own R2 buckets and
Durable Objects, the existing production Hyperdrive connection, production
database and environment values, and the production base/auth URLs. No Azure
app deployment or database migration is required by the router.

## Monitor from this repository

```sh
node scripts/cloudflare-rollout-report.mjs 24
```

The argument is a 1–168 hour window. Authenticate `@posthog/cli@latest` against
the EU instance. **Project 169929, displayed as Code2Create, is ExamCooker**:
its public project key was matched to the live Azure app configuration. The
report refuses to query another active project.

The router records `ec_cutover_request` with backend, status and time to origin
headers. The same injected browser code on both backends records:

- `ec_cutover_page`: navigation TTFB, HTML completion and DOM-ready times.
- `ec_cutover_vital`: LCP and CLS, sent when the document becomes hidden.
- `ec_cutover_pdf`: first visible decoded PDF blob image after a paint frame.
- `ec_cutover_error`: uncaught browser errors/rejections, capped at five per page.

These measurements cover full document loads, not every client-side navigation.
Origin duration is not full HTML streaming time. Browser events may be lost if
a visitor closes early, disables JS, or blocks telemetry. Error-event counts
are not error rates; use affected documents / browser document samples.
Country, device class, sanitized route and page ID support matched comparisons.
No auth tokens, user IDs, error messages, IP addresses or URL queries are sent
by the new telemetry. Existing application analytics remain unchanged.

All authenticated traffic and synthetic deployment probes are excluded from
the comparison report. Expect small Cloudflare samples at first; compare the
same route/device/country and report counts before drawing latency conclusions.
Investigate sustained 5xx, broken auth/assets/PDFs, or materially worse p75/p95
before increasing the percentage. This is an operational canary, not a formally
powered product experiment. Monitoring is queried on demand from this chat.

## Change percentage or roll back

Edit `vars.CF_PERCENT` in `wrangler.rollout.jsonc`, then:

```sh
pnpm exec wrangler deploy --config wrangler.rollout.jsonc
```

**Rollback: set it to `"0"` and deploy.** This overrides existing canary
cookies. Keep the routing Worker installed during rollback: stale Cloudflare
tabs cannot send mismatched RSC or Server Action requests to the other build.
Next falls back to a full destination navigation for RSC reads; blocked actions
signal a reload without replaying the mutation. Background prefetches never
reload the current page. Missing immutable chunks can be read from the other build.
Mutations are never retried across backends. Do not delete the canary Worker or
its assets while old browser tabs may still need them.

Emergency DNS bypass (only if the routing Worker itself is broken):

```sh
npx --yes cf@latest dns records edit 0461e08fd7e41cd25f889ed50e145c9f \
  -z acmvit.in --body '{"proxied":false,"ttl":600}'
```

This returns the original Azure CNAME to DNS-only operation, subject to DNS
propagation. It cannot preserve old canary tabs' build affinity, so the 0%
router rollback is preferred.

## Build and deploy the canary app

Keep production secrets outside git. Build-time `NEXT_PUBLIC_*` settings must
match production; changing runtime secrets cannot repair a wrong public build.
Use the production `AUTH_SECRET`, database, storage and provider values.
Keep `.cloudflare-deploy/` and `.dev.vars*` ignored. The canary configs have no
public route: traffic reaches the app through the router's service binding.

```sh
pnpm exec wrangler deploy --config wrangler.canary-app-state.jsonc
pnpm exec wrangler deploy --config wrangler.canary-tag-cache.jsonc
pnpm exec opennextjs-cloudflare build --config wrangler.canary.jsonc
pnpm exec opennextjs-cloudflare deploy --config wrangler.canary.jsonc
pnpm exec wrangler secret bulk /private/path/canary-secrets.json --config wrangler.canary.jsonc
```

The router needs `SIGNING_SECRET`, `PROBE_SECRET` and `POSTHOG_KEY` secrets.
Do not rotate the signing key casually; rotation invalidates cohort cookies.
Privileged smoke tests use `x-ec-probe` plus `x-ec-force-backend` to select a
backend; the router removes these headers before forwarding and marks all such
telemetry synthetic. Its workers.dev preview requires the probe secret.
Full PDF/auth browser tests must use the production hostname: storage CORS and
Server Action origin validation correctly reject the temporary preview host.

HTML, RSC, API and other non-immutable responses are private/no-store. Only
public data inside the application uses Next/OpenNext caches. Sessions are
never placed in a shared response cache. Azure still owns authenticated writes
and Redis state during this phase; cross-platform cache invalidation needs
separate review before a broader authenticated cutover.

## Validation

```sh
pnpm exec tsx --test cloudflare/cutover/policy.test.ts
pnpm exec tsc -p cloudflare/cutover/tsconfig.json
pnpm exec wrangler deploy --config wrangler.rollout.jsonc --dry-run
```

Also check live course and paper document responses, visible PDF rendering,
session/API routing, sticky assignments, static assets, and PostHog ingestion
on both backends. Use one muted headless browser at a time. Repository lint
remains unavailable (`next lint` was removed; no ESLint setup is installed).
