# Browser PDF engine and Worker startup

The PDF viewer uses `ssr: false`, but its preload hook is imported by an SSR
component. That hook pulled the browser PDFium engine into the Next server
dependency graph and consequently into the Cloudflare Worker.

Put the dynamic engine imports inside an explicit `typeof window !==
"undefined"` branch. Next now removes the dependencies from the server build;
the browser keeps the same engine, WASM resource, timeout, cancellation, and
rendering behavior. An early server-side throw alone did **not** remove the
generated import chunks, so the built-artifact check matters here. The Worker
bundle audit now fails if either PDFium package reappears in server source maps.

## Size measurements

Both measurements use ec-test's configuration and the same dependency versions.

| Artifact | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| OpenNext server handler | 20,857,885 bytes | 19,769,258 bytes | 1,088,627 bytes (5.2%) |
| Handler gzip | 5,276,043 bytes | 5,069,275 bytes | 206,768 bytes (3.9%) |
| Wrangler total upload | 31,864.46 KiB | 30,676.80 KiB | 1,187.66 KiB (3.7%) |
| Wrangler upload gzip | 6,966.94 KiB | 6,756.80 KiB | 210.14 KiB (3.0%) |

These are server deployment sizes, not reductions in the browser's PDF download.
The PDFium WASM asset is still required in the browser. A smaller Worker is a
verified outcome; it does not by itself establish a navigation speedup.

## Rejected early-cache experiment

An ec-test-only experiment started the public route-shell cache lookup before
loading the Next server. It retained the existing tag checks and avoided
session, preview, and mutation requests. Baseline, candidate, and restored
baseline each received five rounds across home, papers, and notes.

First-invocation Worker medians (milliseconds, sample count in parentheses):

| Route | Baseline | Candidate | Restored baseline |
| --- | ---: | ---: | ---: |
| Home | 394 (4) | 284 (3) | 366 (4) |
| Papers | 409 (4) | 363 (4) | 267 (5) |
| Notes | 251 (3) | 271 (3) | 362 (5) |

The candidate was inconsistent, including a 1,067 ms first home invocation.
Regional routing and isolate reuse varied; some restored baseline samples beat
the candidate. The candidate's initial requests also overlapped a correctness
check. This did not justify the added cache coordination code, so the entire
experiment was removed before production deployment.

Latency probes use sequential requests with 6.1 seconds between them. They
retain remote-edge outliers and record Worker version, first-invocation marker,
Cloudflare region, headers, and response completion. These small samples are
not controlled cold starts or browser paint measurements.

## Retained change: live results

The browser-only engine deployment is ec-test Worker version
`ddef6b7e-7037-44c9-8e73-15c2d1a7c011`. Its 15-request latency batch ran alone,
before correctness checks. All responses returned HTTP 200 and complete HTML
without server-render digests.

| Route | Restored baseline first-request Worker median | Browser-only engine first-request Worker median | Browser-only engine client headers median |
| --- | ---: | ---: | ---: |
| Home | 366 ms (4) | 399 ms (5) | 1788 ms (5) |
| Papers | 267 ms (5) | 302 ms (5) | 1707 ms (5) |
| Notes | 362 ms (5) | 435.5 ms (4) | 1435.5 ms (4) |

The new deployment includes Boston outliers on home and notes; the earlier
baseline includes Newark outliers. Fourteen of the new deployment's fifteen
probes were first isolate invocations. The one later notes invocation took
91 ms in the Worker and 435 ms to client headers. **This sample does not show a
latency win.** Keep the dependency removal for its measured bundle reduction,
not as a claim that the larger first-request delay is fixed.

[Raw measurements](benchmarks/browser-engine-latency-2026-09-28.json) include
every request from all four stages and the browser smoke observations.

## Validation

- App and Cloudflare typechecks; all 28 built PPR payloads; server bundle audit.
- Eight PDF reliability/rotation tests, including actual PDFium pixel output.
- ec-test session and CSRF isolation, private response headers, concurrent and
  canceled HTML streams, runtime RSC prefetches, native association endpoints,
  and upload pages.
- One muted headless browser verifies the edited BCSE203E paper renders its
  saved 90-degree rotation, with no browser errors. Subsequent home, papers, and
  notes search checks use the deployed build and also report no errors.

Browser measurements are single observations: PDF navigation response completion
was 7436 ms before and 4599 ms after, while WASM transfer was 2862 ms before and
910 ms after. The browser still fetched the same 2,142,121 encoded WASM bytes;
network and cache variability prevent attributing those differences to this
server-only change. Search took 6–16 ms after initialization. None of these
smoke observations establishes a population-level improvement.

The anonymous rollout remains at 50%. This change does not alter session
caching, content cache lifetimes, or cross-backend edit invalidation. Lint is
still unavailable with the repository's current Next 16 setup.
