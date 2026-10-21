# Cloudflare deployment

`examcooker-prod` serves production at `examcooker.acmvit.in`. The legacy
`exam-cooker.acmvit.in` hostname redirects to it. All application traffic,
including sign-in, APIs, uploads, moderation, and MCP, runs on Cloudflare.

## Direct GitHub builds

Cloudflare Workers Builds connects directly to this repository:

| Branch | Worker | Build | Deploy |
| --- | --- | --- | --- |
| `main` | `examcooker-prod` | `pnpm cf:build:prod` | `pnpm cf:deploy:prod` |
| `dev` | `examcooker-canary` | `pnpm cf:build:canary` | deploys (see below) |
| Other branches | `examcooker-canary` | `pnpm cf:build:canary` | `pnpm cf:upload:canary` |

Pull requests merge into `dev` first. `dev` deploys the canary site,
`https://examcooker-canary.acmvit.workers.dev`, which uses production data,
placement and limits; sign-in links still point at the production hostname.
After checking a change there, merge `dev` into `main` to deploy production.
One canary trigger serves every non-`main` branch. Its deploy command works
with any checkout, including branches older than this flow:

```sh
if [ "$WORKERS_CI_BRANCH" = dev ]; then pnpm exec opennextjs-cloudflare deploy --config wrangler.canary.jsonc --cacheChunkSize 5; else pnpm cf:upload:canary; fi
```

Unknown branches upload an inactive version. No canary build can replace
production. `pnpm cf:deploy:canary` runs the same deploy manually. There are no GitHub Actions deployment workflows.

Build settings require `DATABASE_URL`, build-time `AUTH_*` values,
`NEXT_PUBLIC_MICROSERVICE_URL`, and `NEXT_PUBLIC_POSTHOG_*`. Source maps require
`POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, and `POSTHOG_CLI_HOST`.
Runtime secrets are configured separately. Preserve the application auth secret
when moving hosts so existing sessions remain valid.

Source maps are checked, uploaded, and removed before packaging. Upload failure
stops the build. Browser telemetry and source maps use the same Git revision.

## Runtime and performance

`wrangler.production.jsonc` defines production. `wrangler.canary.jsonc` defines
the canary site and preview uploads; `wrangler.jsonc` defines ec-test. These environments use the
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

Old Azure pages must reload before submitting Server Actions. Tabs opened on an
earlier build keep loading that build's hashed files after a deploy: each
production version copies its `/_next/static` chunks, CSS, media and PDF engine
into the `examcooker-prod-static-archive` R2 bucket once, starting from its first
requests (one isolate at a time, under an R2 lock), with a 10-minute cron as a
retry backstop. Requests for files the current build lacks are served from there. Objects
expire after 30 days. Application requests and mutations never use the archive.

## Validation and rollback

Before deploying, verify complete HTML/RSC streams, visible PDFs, authentication
and CSRF isolation, private responses, CLI/MCP access, uploads, and source maps.
Use `cf` to inspect deployments and restore an earlier production Worker version
if needed. Do not restore traffic to the retired Azure App Service.

Azure Blob Storage and the separate upload processor remain part of the asset
pipeline; see [cloudflare-assets.md](cloudflare-assets.md).
