# Dependency update validation — 13 October 2026

Updated the web app, CLI, and local Capacitor plugin against the npm registry. Direct packages use their current stable releases; Drizzle remains on its existing release-candidate line, upgraded from rc.1 to rc.4. The application and CLI compilers use TypeScript 7.0.2. `typescript-api` deliberately remains on 6.0.3 because the course-data parser requires the JavaScript compiler API that TypeScript 7 no longer exposes.

| Component | Updated version |
| --- | --- |
| Next.js / React | 16.4.0 / 19.3.0 |
| MCP Apps / split MCP client, server and core | 2.0.3 / 2.3.1 |
| Capacitor core, Android, iOS and CLI | 8.5.3 |
| EmbedPDF | 2.15.1; regenerated PDFium WASM and asset hash |
| Drizzle ORM / Kit | 1.0.0-rc.4 |
| OpenNext Cloudflare / AWS adapter | 1.20.10 / 4.1.9 |

MCP imports and tool schemas follow the [v2 migration guide](https://apps.extensions.modelcontextprotocol.io/api/documents/migrate-to-v2.html). The newer Clack cancellation symbol is excluded by the CLI's existing cancellation wrapper. Agents' exact 2.0.0 MCP peer declarations permit the installed 2.3.1 versions through scoped peer rules; worker typechecking and local worker startup/health checks pass.

The OpenNext patches were rebased onto the new packages. AWS now supplies request isolation upstream; the remaining patch retains pending cache entries until persistence completes and prevents an older writer from deleting a newer pending write. Cloudflare retains the existing Cache Components integration, revalidation, tag-cache and R2 encoding changes. Its Next 16.4 patch now matches the draft-mode expression, preserves CacheSignal constructor arguments, and verifies the upstream resume-cache copy instead of failing when it is already present. Patch checks still fail if no recognized implementation is found.

## Security

The initial local audit reported 71 findings, including three critical findings. The updated lockfile reports zero vulnerabilities across all severities. Scoped transitive overrides cover packages whose parent dependencies still retain vulnerable versions, including the SDK v1 dependency in Agents, proxy-addr, sharp, glob, KaTeX, XML/URI parsers, and source-map-js. Existing compatible major lines are retained where a blanket major upgrade would change the parent's API or runtime requirements.

GitHub initially reported 55 open Dependabot alerts. Both Swift lockfiles and the generated iOS/Android dependency configuration now use Capacitor 8.5.3, addressing the [native proxy-origin advisory](https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv). Local catalog searches are read-only. No alerts were dismissed, no packages published, and no deployment performed; GitHub's alert state will update after the changes reach its default branch and it rescans.

## Validation

- Frozen-lockfile installation passes; no peer dependency issues remain.
- All 79 repository tests pass, including MCP, PDF, voice, proxy and cutover tests.
- Two additional local checks pass against the installed patched adapters: pending-write/superseded-writer behavior and legacy/compressed R2 round trips.
- Web, Cloudflare app/command-worker, CLI and native-tab TypeScript checks pass. CLI and native-tab package builds pass; CLI help runs.
- Production Next.js build passes.
- Cloudflare build and Wrangler deployment dry run pass, including incoming separate server-module packaging. Source-map upload was disabled for local validation.
- iOS simulator build passes without code signing. Xcode resolves Capacitor 8.5.3.
- The native-tab plugin’s standalone SwiftPM lockfile now also resolves Capacitor 8.5.3 (revision `4c7f346d16196e21fbe23d4a7a6fc7af62af6742`). A standalone `NativeTabsPlugin` iOS simulator build passes for arm64 and x86_64 without code signing.
- Android debug build passes (Gradle 8.14.3, 306 tasks).
- The actual development catalog works through the local MCP HTTP endpoint and preview host: BMAT101L search, resource details, and model-context attachment. This does not establish hosted ChatGPT validation.
- Desktop and 390px browser checks cover catalog search, shared styling, widget filters, detail/back navigation, deep links, theme changes, empty results and failed-host-result recovery, and search retention when the initial opening result arrives late. No horizontal overflow or browser errors were observed.
- `pnpm lint` remains unavailable: the repository still invokes the removed `next lint` command.

## Incoming changes

Merged all 15 incoming commits from `origin/dev` through `f03d834` in local merge `bccd941`. This also contains `origin/main`. Reviewed PDF fallback/delivery, asset mirroring, caching, PostHog filtering, and the separate Worker module experiment. The only update conflicts were the obsolete OpenNext patch file and its old lockfile hash; the new patch and regenerated lockfile retain the incoming header correction. The merged PDF, asset and PostHog regression tests are included in the 79 passing tests.

## Review fixes — 15 October 2026

- Type filters preserve pending searches, search drafts, and keyboard focus. Search controls stay mounted across result redraws; navigating away from a pending detail still prevents that detail from reopening.
- Widget-only `filterResults` retains every provider's matches before the mixed 20-result cutoff. Standard search text and structured citation results remain capped and unchanged in shape.
- Module rendering preserves every URL on a line and removes trailing separator punctuation.
- DOM tests execute the embedded script with delayed host responses, covering opening/search races, filtering, drafts/focus, detail/back navigation, and module links. Error tests cover redacted nested causes, codes, stack frames, SQL messages, and transport responses.
- All 89 repository tests pass. Web type-checking, a frozen pnpm install, the Cloudflare adapter build, and Wrangler deployment dry run pass. Source-map upload was disabled for the local build.
- Live catalog checks confirm that switching to Resources while a broad search is pending displays five resources after completion; changing another filter retains an unsubmitted `BMAT101L` draft and filter focus.
- Both Vercel and Cloudflare failed their prior dependency installation using pnpm 10. The repository now pins pnpm 12.8.1, and the Cloudflare non-production trigger has `PNPM_VERSION=12.8.1`. A fresh hosted run confirms that both providers install with pnpm 12.8.1. Vercel then exposed an obsolete `npx prisma generate && next build` project override; `vercel.json` now selects the repository’s `pnpm build` command. Cloudflare then fails because its build environment lacks `AUTH_GOOGLE_ID` (and must configure the matching Google secret). Its trigger also still specifies a plain Next build rather than the Cloudflare adapter build. The separate Vercel account-blocked check is an external account issue.
