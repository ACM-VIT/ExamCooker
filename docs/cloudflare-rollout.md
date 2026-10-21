# Cloudflare deployment

`examcooker-prod` serves production at `examcooker.acmvit.in`. The legacy
`exam-cooker.acmvit.in` hostname redirects to it. All application traffic,
including sign-in, APIs, uploads, moderation, and MCP, runs on Cloudflare.

## Direct GitHub builds

Cloudflare Workers Builds connects directly to this repository:

| Branch | Worker | Build | Deploy |
| --- | --- | --- | --- |
| `main` | `examcooker-prod` | `pnpm cf:build:prod` | `pnpm cf:deploy:prod` |
| Other branches | `examcooker-canary` | `pnpm cf:build:canary` | `pnpm cf:upload:canary` |

Canary builds upload inactive versions. They cannot replace production.
There are no GitHub Actions deployment workflows.

Build settings require `DATABASE_URL`, build-time `AUTH_*` values,
`NEXT_PUBLIC_MICROSERVICE_URL`, and `NEXT_PUBLIC_POSTHOG_*`. Source maps require
`POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, and `POSTHOG_CLI_HOST`.
Runtime secrets are configured separately. Preserve the application auth secret
when moving hosts so existing sessions remain valid.

Source maps are checked, uploaded, and removed before packaging. Upload failure
stops the build. Browser telemetry and source maps use the same Git revision.

## Runtime and performance

`wrangler.production.jsonc` defines production. `wrangler.canary.jsonc` defines
preview uploads; `wrangler.jsonc` defines ec-test. These environments use the
production database and are not disposable data sandboxes.

Production runs near the database in AWS Mumbai using a dedicated Hyperdrive
pool with a 100-connection origin limit. Query caching stays disabled so auth,
upload receipts, and moderation reads remain current. Public application data
uses R2 and regional caches with explicit invalidation.

The production Worker allows 300,000 ms CPU and 10,000 subrequests per request.
These limits provide execution headroom; latency still depends on application
work, cache hits, and network round trips. Tag caches and application state use
small separate Workers to avoid loading Next.js for each Durable Object call.

Keep `enableCacheInterception: false` so Next resumes dynamic PPR boundaries.
Personalized HTTP responses must remain private/no-store.

Old Azure pages must reload before submitting Server Actions. Old canary
JavaScript, CSS, and font requests can fall back to the previous canary Worker;
application requests and mutations never use that fallback.

## Validation and rollback

Before deploying, verify complete HTML/RSC streams, visible PDFs, authentication
and CSRF isolation, private responses, CLI/MCP access, uploads, and source maps.
Use `cf` to inspect deployments and restore an earlier production Worker version
if needed. Do not restore traffic to the retired Azure App Service.

Azure Blob Storage and the separate upload processor remain part of the asset
pipeline; see [cloudflare-assets.md](cloudflare-assets.md).
