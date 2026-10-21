# Public assets

`cloudflare/assets-worker.ts` serves the production Azure container's R2 mirror
at `https://ec-assets.acmvit.in`, configured by `wrangler.assets.jsonc`.
Cloudflare builds use this host for public PDFs and thumbnails. Database URLs
and Azure builds retain their existing asset URLs.

Azure Event Grid sends BlobCreated/BlobDeleted events to `/_events`,
authenticated by `x-ec-mirror-token` matching the Worker's `MIRROR_TOKEN`
secret. Monitor Event Grid delivery failures and the Worker's
`[asset-delivery]` errors.

Copies stream from the current Azure object into R2, preserve metadata, and
verify checksums. Conditional writes prevent older copies from overwriting newer
versions. Deletion tombstones prevent read-through from restoring deleted files.
Missing objects are copied on demand; the Worker never modifies source blobs.

Responses support HEAD, byte ranges, conditional requests, and anonymous CORS.
Browser/edge caching lasts up to 60 seconds. Page rotation/order edits remain
database-backed and do not rewrite the stored PDF.

The authenticated `/_mirror` endpoint can reconcile a single Azure key or
inspect R2 metadata. It accepts fixed-source keys, not arbitrary upstream URLs.
Keep `MIRROR_TOKEN` in Worker secrets.

Coverage: `scripts/cloudflare/test-asset-delivery.mjs` exercises the Worker
against a local R2 fixture; `lib/storage/public-assets.test.ts` checks URL mapping.
