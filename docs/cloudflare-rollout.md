# Cloudflare deployment

Azure App Service serves production alongside the `examcooker-canary` Worker.
The `examcooker-rollout` router assigns **50% of new anonymous browsing
sessions** to Cloudflare, using a signed cookie that lasts 24 hours. Signed-in
traffic, auth, APIs, uploads, moderation, and MCP remain on Azure.

## Direct GitHub builds

Cloudflare Workers Builds connects directly to this repository. The main and
branch triggers both target `examcooker-canary`:

| Setting | Command |
| --- | --- |
| Build | `pnpm cf:build:canary` |
| Deploy | `pnpm cf:upload:canary` |

The upload command populates the build-specific R2 cache and uploads a Worker
version. It does **not** activate the version or change traffic allocation.
Azure deployment remains in `.github/workflows/deploy-appservice.yml`.

Set build variables in Cloudflare's build settings: `DATABASE_URL`, the
`AUTH_*` values needed to build, `NEXT_PUBLIC_MICROSERVICE_URL`, and the
`NEXT_PUBLIC_POSTHOG_*` values used by the app. Source-map uploads require
`POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, and `POSTHOG_CLI_HOST`.
Use the same PostHog settings in the Azure workflow. Runtime secrets are
configured separately on each Worker.

Source maps are checked, uploaded, and removed before packaging. Upload failure
stops the build. The source-map release and browser telemetry use the same Git
revision.

## Targets and validation

- `wrangler.jsonc`: `examcooker-test` at `ec-test.acmvit.in`.
- `wrangler.canary.jsonc`: production canary, reached through the router.
- `wrangler.rollout.jsonc`: routing policy and `CF_PERCENT`.

Build each target fresh with its own public/auth URLs. Test and canary use
separate R2 buckets and Durable Objects. Both use production services, so
ec-test is not a disposable data sandbox.

Keep `enableCacheInterception: false` so Next resumes dynamic PPR boundaries.
Application data may use the R2/regional caches; personalized HTTP responses
must remain private/no-store.

Before activating a canary version, verify complete document/RSC streams,
visible PDFs, session isolation, assets, and source-map upload. Use the
production hostname with the router's `x-ec-probe` and
`x-ec-force-backend` headers for synthetic checks; storage CORS and Server
Action origin checks depend on that hostname. Keep the rollout at 50%.

## Rollback

Restore the previous canary deployment with the Cloudflare CLI. To send all
traffic to Azure, set `CF_PERCENT` to `"0"` and deploy the router; this
overrides existing canary cookies. Retain the router and old canary assets so
open tabs keep their build affinity. Mutations are never replayed between
backends.
