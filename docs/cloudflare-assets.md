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

## First-page previews

Paper pages show an image of the first displayed page while the PDF and its
4.6 MB rendering engine download. `/_preview/v1/past-papers/<id>/p<page>-r<rotation>.webp`
renders `past-papers/<id>/paper.pdf`; papers uploaded before that layout keep a
root `<uuid>.pdf` key and use `/_preview/v1/<uuid>/p<page>-r<rotation>.webp`
(`lib/pdf/preview-source.ts` defines both for the app and Workers). Previews are
served from `_previews/v1/…` in the same bucket, outside the Azure key space.
A stored preview is used only while its `sourceEtag` matches the current PDF
object; otherwise `examcooker-pdf-preview` (`wrangler.pdf-preview.jsonc`, no
public route) renders it with PDFium and the Images binding. PDFs that cannot be
rendered (encrypted, over 24 MB, page out of range) get an empty failure marker
for that source version, so they are not retried on every view.

New renders are limited to 60 per client IP per minute (`PREVIEW_RENDERS`);
stored and edge-cached previews are not. A throttled or failed preview returns
an error and the page shows the normal viewer.

Deploy `wrangler.pdf-preview.jsonc` before `wrangler.assets.jsonc`, which binds it.

Coverage: `scripts/cloudflare/test-asset-delivery.mjs` exercises the Worker
against a local R2 fixture; `lib/storage/public-assets.test.ts` checks URL mapping.
