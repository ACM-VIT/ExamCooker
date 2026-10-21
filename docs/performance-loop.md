# Performance work: measure a journey, prove a change, keep the result

This applies the workflow from the supplied September 23 article, *How we made claude.ai 3x faster in two weeks*, to ExamCooker's Azure / Cloudflare migration. The article's reported speedups are not targets or evidence for this app.

## Journeys and the scorecard

Prioritize opening the home page, finding a course, opening a paper, and moving between papers. End paper measurements at a visible decoded page, not an HTTP 200, completed download, or mounted spinner. Separate desktop/mobile, backend, build, full navigation/client navigation, and first/later Worker invocation. Show sample counts, p50/p75/p95, failure/abandonment coverage, and bytes or work counts together.

The October 6 review, cutoff 10:50 IST, supports retaining the existing 50% anonymous rollout. Since October 1 at 09:30 IST, India paper HTML p50 is 967ms Azure / 2,647ms Cloudflare on desktop (590/651 samples), and 1,008/3,007ms on mobile (233/211). Visible PDF p75 is 4,312/5,289ms on desktop (244/297 samples) and 4,733/7,063ms on mobile (133/136). These describe reported full-document loads, not all attempted opens.

## First measured change: finish the intent preload

The course paper card already preloads PDF bytes and the engine after hover, focus, or touch intent. Saved rotations and ordering need `pdf-lib`, but that download previously waited for the viewer to mount. Starting it with the two other independent inputs removes a later dependency. Only papers with nonempty normalized edits warm the library; applying, saving, and downloading edits keep their existing behavior.

`scripts/bench-pdf-intent.mjs` compiles the real card's warm callback and real PDF download, engine, and page-edit modules. A local server supplies a generated two-page PDF, the installed PDFium WASM, and split browser chunks. It controls three conditions: 300ms between intent and opening, 100ms PDF/WASM response delays, and a 500ms edit-library response delay. No application database, authentication, production PDFs, or analytics are used.

Three edited and three unedited runs before and after the change, alternating document type:

| Measurement | Before | After |
| --- | ---: | ---: |
| Edited paper, click to visible median | 547ms | 250ms |
| Edited paper, click to visible range | 541–577ms | 240–293ms |
| Edit-library requests starting before click | 0/3 | 3/3 |
| Unedited paper, click to visible median | 33ms | 35ms |
| PDF transfers per open | 1 | 1 |
| WASM transfers per open | 1 | 1 |
| Edit-library transfers for unedited papers | 0 | 0 |

The changed path saves about 297ms in this controlled scenario by using the available intent lead time. It does not establish a production percentage improvement or fix Cloudflare's first-invocation delay. A tap immediately followed by navigation provides less overlap; a long hover may hide more of the download. No savings are promised for an already-cached edit library or an unedited paper.

## Guard the mechanism, not noisy milliseconds

Run:

```sh
node scripts/bench-pdf-intent.mjs
node --test cloudflare/cutover/rum.test.mjs
node --import tsx --test lib/pdf/reliability.test.ts lib/pdf/pdf-buffer-cache.test.ts lib/pdf/render-rotation.test.ts
```

The browser benchmark requires `agent-browser` and initialized PDFium assets (`node scripts/sync-pdfium-wasm.js`). It uses one muted headless browser and closes it afterward. It fails if an edited paper's library starts after the click, if either input is transferred twice, if an unedited paper requests the edit library, or if PDFium's actual pixels differ from the expected saved rotation/page order. Repeated intent is exercised. The benchmark prints timings for diagnosis but never gates CI on milliseconds.

The dedicated PR workflow runs these contracts without production secrets or a deployment. Its GitHub-hosted execution still needs verification after the branch is pushed. For a negative control, point `--source` at the pre-change paper-card source: the edit-prefetch assertion must fail. Add `--allow-late-edits` only to collect baseline timing without that assertion.

The router's RUM collector now also recognizes the renderer's bounded inline-image recovery path. It still requires a marked PDF page, decoded pixels, foreground visibility, the initial document route, and an on-screen image. It reports the first visible page once. Without this correction, a successfully recovered image would disappear from the PDF timing population.

## Release and next iteration

The first candidate was deployed to ec-test on October 6 as `caf1a0fc-1f94-40ad-9b43-3379939b2573`; real unedited/edited papers, client navigation, preloading, and forced image recovery passed. For subsequent candidates, deploy to ec-test first. Verify real unedited/edited PDFs, saved edits, downloads, private response caching, and routing before production promotion. Deploy the small RUM correction with the image-recovery change. Keep the separate ec-test server-module experiment separate from production promotion. The rollout stays at 50% until matched production results justify expansion.

After shipping, compare builds over the same complete windows, report failed/abandoned attempts beside successful-load percentiles, and retain the deterministic contracts only while they protect a demonstrated latency mechanism. Revert or revise any optimization whose production effect is absent or harmful.

The cutover document-load PDF timing intentionally stops on client navigation. The separate client-navigation measure below closes this gap for new app builds; do not combine its durations with the cutover metric. Next server investigation: attribute first-invocation and HTML streaming time to actual work/cache waits; changing module packaging alone has not yet proved a population win. Avoid a broad caching change without invalidation and session-isolation checks.


## Second iteration: measure client paper opens

`instrumentation-client.ts` uses Next's `onRouterTransitionStart` hook. Every supported client navigation to a different paper path starts an attempt. Modified-click/new-tab links and downloads do not enter this framework hook; same-path query/hash updates do not create a new attempt. The clock begins at router dispatch, not pointer-down or document creation. Client-side back/forward traversal is included. Full-document opens remain in the existing router RUM population.

| Event | Meaning |
| --- | --- |
| `pdf_open_started` | A paper navigation was dispatched; `journey_id` pairs it with its eventual outcome. |
| `pdf_open_finished` / `visible` | A marked PDF image is decoded, intersects the viewport after scroll-container clipping, and remains visible across two animation frames. |
| `pdf_open_finished` / `render_error` | The active destination viewer shows a terminal error before a visible page. |
| Other finished outcomes | `superseded`, `backgrounded`, `pagehide`, or `timeout` (60 seconds). These are coverage outcomes, never successful-load latency samples. |

Both events include `journey_version: 1`, `sampling_rate: 1`, navigation type, the previous destination's route category, application revision, and document backend. Custom properties exclude paper IDs, paths, query strings, asset URLs, and document contents; PostHog retains its normal SDK page/session context. `viewer_ready_ms` marks client viewer-wrapper readiness, so the remainder of `duration_ms` covers loading/rendering after that point. It is not a pure server-time measurement. SDK blocking, consent, browser termination, or transport loss can still create missing events: always report started/finished pairing coverage. Browsers lacking IntersectionObserver or checkVisibility are excluded rather than given inaccurate visible-page timings.

The observer is restricted to the active viewer and is disconnected on every terminal outcome. All asynchronous completion checks are scoped to the current attempt. Saved inline recovery images qualify; thumbnails, old-route images, hidden images, and clipped pages do not. Retained pages are checked on back/forward even when a decoded image does not emit another load event. No background time is resumed into a foreground latency.

Run `node scripts/test-pdf-open-journey.mjs`. Thirteen real-browser contracts cover the measurement population, fresh clocks, cached traversals, clipping, stale frames, cancellation, timeout, teardown, and telemetry exceptions. CI runs these contracts without PostHog credentials. Timing values are diagnostic; the assertions target event pairing, identities, outcomes, and the visibility boundary.

Analyze complete deployment windows by `app_revision`, `document_backend`, device, and navigation type. For successful opens report count/p50/p75/p95; beside them report every outcome count plus unmatched starts. Do not infer a production improvement from synthetic ec-test runs. The browser smoke check's second PDF/WASM reads were cache hits, not duplicate network transfers; they are not a demonstrated optimization target yet.

## Third iteration: include UUID papers in tag prefetch

The server trace found that `publicRouteTags()` accepted older alphanumeric paper IDs but rejected UUIDs. Those public pages skipped the existing speculative metadata read and waited for normal tag validation later. The matcher now accepts both formats. The workerd contract includes a real UUID, malformed UUID exclusions, and the existing request-isolation, mutation, error, and ordering checks. Adding the UUID case failed against the old matcher and passed after the fix. Run `node scripts/cloudflare/test-public-route-tag-prefetch.mjs`; the performance workflow now includes it.

A controlled workerd experiment with the real matcher/wrapper, a simulated 120 ms shell read, and a 160 ms metadata read moved UUID data readiness from a 282 ms median to 162 ms (three runs each). The old-ID control remained 161/162 ms. Both variants performed one simulated metadata lookup. This proves overlap in that model, not a user-visible speedup. That earlier wrapper joined all speculative tags before releasing a cached shell; shell readiness in the same model moved from 121 to 162 ms. The fourth iteration below removes this gate.

The live ec-test comparison did not establish a win. Six alternating pairs on one diagnostic version, spaced beyond the tag-cache TTL, all completed correctly. Observed app-completion medians were 329 ms without prefetch and 468.5 ms with it, on the Workers I/O clock. First Worker invocations were uneven (3/6 versus 5/6), and paper-specific metadata sometimes took 473–559 ms. Four fresh-browser probes rendered the saved two-page rotations without errors, but their startup conditions also differed. Keep this candidate on ec-test for evaluation; do not promote it as a performance improvement on this evidence.

Clean ec-test version `9691ec08-3177-444a-9eed-c0712614d196` replaces the temporary diagnostic. Its browser build and revision are unchanged from the previous candidate because only the Worker-side matcher changed; compare Worker versions for this iteration. Authentication isolation, private/no-store responses, concurrent/canceled streams, RSC payloads, and tag invalidation across all six regions passed. The former diagnostic token returns ordinary HTML. Production remains at 50% assignment for new anonymous sessions.

For the next iteration, measure the slow paper-tag read and whether the full speculative batch delays the shell. Separate first response from final HTML headers: a browser `responseStart` of 105 ms was an Early Hint, while `finalResponseHeadersStart` was 1,834 ms. Also, a zero-duration import trace is not evidence of zero startup CPU because deployed Workers clocks advance only after I/O ([Cloudflare timing documentation](https://developers.cloudflare.com/workers/runtime-apis/performance/)).

## Fourth iteration: release the shell after its own validation

The October 21 candidate is based on main `5bb83b3` with Next 16.4.0, OpenNext Cloudflare 1.20.10, and AWS adapter 4.1.9. It carries the PDF recovery, intent preload, journey telemetry, and UUID matcher forward. The previous separate-server-module packaging experiment is no longer enabled in `wrangler.jsonc`; ec-test now uses the same packaging as the canary.

The earlier wrapper waited for every speculative tag before returning a cached shell. A slow paper-data shard therefore delayed even a shell whose own invalidation tags were ready. The adapter patch now places pending per-tag reads in OpenNext's request cache and resolves each shard independently. The wrapper returns the cache read immediately; Next's normal validators still await all tags associated with that entry. Regional TTLs, invalidation decisions, replica placement, and write behavior are unchanged. Failed reads are evicted for retry, and promises never cross request boundaries.

`scripts/cloudflare/test-tag-read-coalescing.mjs` runs the real adapter and wrapper in workerd. It holds the data shard until shell validation completes, verifies actual invalidation timestamps, counts one read per tag, and exercises six overlapping requests, missing tags, SWR metadata, and failure/retry. Restoring main's old wrapper makes the shell-release assertion fail; the candidate passes. This is evidence for removing the dependency, not a claimed reduction in end-to-end production cold-start latency.

Current main also needed release repairs: the frozen pnpm lockfile retained a deleted local workspace, and OpenNext's manifest loader omitted Next 16.4's required `server/preview-props.json`. The manifest contract reproduced `Unexpected loadManifest` before the patch and passes afterward while preserving errors for unknown manifests. Two existing cache fixtures now model the upstream request-cache API and recognize Next 16.4's built-in resume-cache seeding.

The first rebuilt ec-test candidate exposed a further scheduler incompatibility: after Next 16.4 installed its timer wrapper, the adapter recaptured that wrapper for its drain hops. Those hops entered Next's native-immediate tracker and the adapter's own pending-work count. The render could never become idle, spun through 1,000 tasks, then truncated the response. The failing version was rolled back to the prior clean ec-test version. Keeping the original native hop with `scheduleMacrotask ??= previousSetImmediate` breaks that cycle without advancing over pending React work. The scheduler contract now imports Next's actual timer implementation and exercises its `ImmediateTracker`; it reproduces the failure before the fix and passes afterward across twelve overlapping requests, failure recovery, and cancellation. The generated Worker bundle also asserts that this fix and the preview manifest are present.

The local browser checks passed on the upgraded dependencies: five PDF image recovery/cancellation scenarios, thirteen paper-navigation telemetry contracts, and actual PDFium pixels for saved order/rotation. The intent benchmark reported 253 ms for the edited case and 30 ms for the plain case in its controlled one-round rerun; both made one PDF and one WASM transfer, and only the edited case fetched edit support. The full Next/OpenNext build, 28 built PPR resume payloads, concurrent scheduler checks, six-region invalidation, and TypeScript checks passed. `pnpm lint` remains unavailable because it invokes the removed `next lint` command.

The fixed candidate is live on ec-test as `61001490-f5d8-4057-ba70-77fc67cff3f2`. Full live session/stream checks and actual edited, plain, and forced-recovery PDF opens passed. Cold browser PDF visibility remained 5.88–10.02 seconds in two fresh opens, so a startup performance win is still unproven.

Production preparation and the promotion/rollback checklist are recorded in `docs/cloudflare-release-readiness.md`. Keep the production assignment at 50% while evaluating matched post-release measurements; first-invocation startup remains a separate performance risk.
