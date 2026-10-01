# Public assets on Cloudflare R2

The production `examcookerprodsi/exam-assets` Azure container is mirrored to
`examcooker-prod-assets` in Cloudflare R2 (APAC location hint). Development and
transfer/backup containers are excluded.

`cloudflare/assets-worker.ts`, deployed with `wrangler.assets.jsonc`, serves these
public files at `https://ec-assets.acmvit.in/<original blob key>`. Only the
Cloudflare app build changes browser PDF downloads, preloads and thumbnails to
that host. Azure builds and database URLs retain their existing behavior.

## Synchronization and correctness

Azure Event Grid subscription `examcooker-r2-mirror` observes BlobCreated and
BlobDeleted events within the production container. It delivers one event per
request to `/_events`, authenticated by a secret `x-ec-mirror-token` header matching
the Worker's `MIRROR_TOKEN` secret. Event Grid retries failed deliveries for up to
24 hours, with at most 30 attempts. Monitor Event Grid delivery failures and the
asset Worker's `[asset-delivery]` errors.

The Worker fetches the current Azure object with `cache: "no-store"`, rather than
trusting event order or a cached storage response. Transfers stream directly from
Azure into R2, preserve content type and metadata, and compare the source stream's
MD5 against the completed R2 write. Azure's Content-MD5 is also checked when
provided. Conditional writes prevent a slower copy from overwriting a newer R2
version. A failed condition returns 503 so the delivery is retried.

Deleted blobs receive a conditional tombstone in R2 and return 404. This prevents
read-through fallback from resurrecting a previously deleted file. The mirror
never writes to or deletes production source blobs. New objects missing from R2
are copied on demand, covering the interval before their upload event arrives.

Public asset responses support HEAD, byte ranges, conditional requests and
anonymous CORS. Browser/edge caching is limited to 60 seconds: an overwritten or
deleted file may remain in those caches for that period after synchronization.
Database-backed page rotation/order edits remain independent of the stored PDF.
Auth, HTML and application API responses do not use this asset cache.

## Repeat or verify a copy

`/_mirror` requires the same secret header. It supports copying a single fixed
Azure key, reading an object's metadata, and listing R2 metadata. It does not
accept arbitrary upstream URLs. Neither administrative route is accessible
without the secret.

Export a fresh Azure inventory into an ignored directory, then run:

```sh
# Supply EC_MIRROR_TOKEN through your secret manager/environment.
az storage blob list --account-name examcookerprodsi \
  --container-name exam-assets --auth-mode key --num-results '*' \
  -o json > .cloudflare-deploy/azure-assets.json
node scripts/storage/mirror-azure-to-r2.mjs \
  .cloudflare-deploy/azure-assets.json .cloudflare-deploy/r2-results.jsonl
```

The tool uses six concurrent metadata-only requests and appends verified object
sizes, source ETags, MD5 and SHA-256 results. Rerunning resumes completed objects
only when their source ETag and size still match the supplied inventory. Refresh
the Azure inventory and reconcile the destination afterward to catch changes
made during the initial copy. Source/secret files and migration outputs must not
be committed.

Deploy the asset Worker before the app:

```sh
pnpm exec wrangler deploy --config wrangler.assets.jsonc
# Provision MIRROR_TOKEN with Wrangler's secret commands; never use vars.
pnpm cf:build
```

The OpenNext build sets `EC_CLOUDFLARE_BUILD=1`; Next embeds the public asset host
in that build. Standard `pnpm build` embeds an empty override. There are no
changes to the database schema or anonymous rollout percentage.

Validation: `node scripts/cloudflare/test-asset-delivery.mjs` exercises streaming
checksums, CORS, ranges, conditional reads, new files, replacement/deletion events,
source restrictions and administrative authentication in workerd. Public URL
mapping is covered by `lib/storage/public-assets.test.ts`.
