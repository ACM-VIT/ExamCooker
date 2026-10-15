# ExamCooker ChatGPT plugin

ExamCooker exposes a public, read-only MCP server at `/mcp`, with a compact resource browser for ChatGPT's sidebar and conversation panel. Search/fetch work without UI; the browser stays mounted while users search, filter, and inspect sources.

The implementation follows the official [Plugin Extensions](https://developers.openai.com/plugins/build/extensions) documentation and [Bits & Bolts example](https://github.com/openai/mcp-extensions/tree/main/plugins/bits-and-bolts), using documented metadata directly without an additional SDK dependency.

## UI and capabilities

The browser uses the website's Plus Jakarta Sans font, original SVG logo, blue branding, cyan/light and navy/dark palettes, and square catalog cards. Website and plugin share `app/components/common/catalog-appearance.css`. `scripts/sync-mcp-ui.mjs` embeds that exact stylesheet, the website SVG, and the local variable font into the widget at build/dev startup. Run `pnpm mcp:sync-ui` after changing any of those sources.

The UI consists of a compact brand/search row, resource-type tabs, a results grid, and resource details with original PDF/site links. The current resource is attached to model context in supporting hosts. There is no large marketing heading or revision panel.

The wordmark uses weight 700 with relaxed spacing. The bundled variable font keeps its appearance consistent when external font requests are blocked.

![Widget wordmark](images/examcooker-mcp-wordmark.jpg)

- **Sidebar and conversation panel:** `open_study_workspace` accepts `{}` or optional query/resourceId inputs. The name is retained as a stable tool identifier.
- **Composer mentions:** `search_resource_mentions` returns canonical resource links. The current official docs describe mentions as a desktop capability; support depends on host and account.
- **Deep links:** `/search?q=Calculus` and `/resource?id=course%3ABMAT101L` via `hostContext["openai/deepLink"]`. External links require the actual installed plugin id.
- **Presentation:** inline/fullscreen modes, host-controlled light/dark theme, keyboard-accessible controls, narrow-screen layouts, reduced motion, and escaped source text.

The integration reads public resources without OAuth. It has no uploads or account write actions. `fetch` returns catalog/module text and PDF links; it does not extract PDF contents. The server and bundled study skill require the model to use actual returned text and request missing material instead of inventing paper contents.

## Tools

| Tool | Input | Output | Presentation |
| --- | --- | --- | --- |
| `search` | `{query: string}`; empty allowed; max 240 chars | `{results: [{id,title,url}]}` | Data only; model and UI |
| `fetch` | `{id: string}`; max 500 chars | `{id,title,text,url,metadata?}` | Data only; model and UI |
| `open_study_workspace` | `{query?: string, resourceId?: string}` | `{view:"workspace",query,results,detail}` | Browser; global/thread entrypoints |
| `search_resource_mentions` | `{query: string}` | `{items: ResourceLink[]}`; up to 10 | App-only composer search |

All tools are read-only, idempotent, non-destructive, and bounded to the ExamCooker catalog. Search/fetch retain the standard single text content item containing JSON, plus matching structured content. Discovery and the empty browser require no database connection; catalog requests use the app's existing configuration.

## Local preview and checks

```sh
pnpm mcp:sync-ui
pnpm mcp:test
pnpm exec tsc --noEmit
pnpm mcp:preview
```

Open `http://127.0.0.1:4318` to test the UI through a local MCP Apps host harness. It uses labeled sample data by default and records model context in `window.latestContext`; it does not create ChatGPT conversations. Use `?theme=light` to preview light mode. The harness is for local development only.

For a live catalog preview, first start the normal app with `pnpm dev`, then run:

```sh
MCP_PREVIEW_UPSTREAM=http://localhost:3000/mcp pnpm mcp:preview
```

Use `MCP_PREVIEW_PORT` to choose another preview port. The existing app/database setup is described in [Development](./development.md). No OpenAI API key is needed: the plugin exposes tools to ChatGPT rather than calling a model API.

Contract tests cover tool metadata, schemas, standard envelopes, entrypoints, mentions, invalid inputs, sanitized failures, versioned resources, widget syntax, shared-style synchronization, canonical URL parsing, and independent stateless HTTP requests. Browser checks should cover search, filters, detail/back navigation, rapid searches, empty/error responses, deep links, theme changes, and mobile overflow.

## Connect to ChatGPT

Inspect `http://localhost:3000/mcp` with `npx @modelcontextprotocol/inspector@latest`, selecting **Streamable HTTP**. GET may return 405 on this stateless endpoint; MCP initialization uses POST.

Expose local development through a public HTTPS tunnel, such as `ngrok http 3000`, or an available Secure MCP Tunnel. Current official setup instructions:

1. Enable **Settings → Security and login → Developer mode** in ChatGPT.
2. Open [ChatGPT Plugins](https://chatgpt.com/plugins) and select the plus button.
3. Add the complete HTTPS URL ending in `/mcp`, with no authentication for the public catalog.
4. Review discovered tools, enable the plugin in a new conversation, and test searching and browsing.
5. Refresh the connection after server metadata changes and reopen the browser.

Test prompts: “Open ExamCooker”, “Find BMAT101L notes and past papers”, “Show Calculus resources”, and “Open this source and explain the available module text”. Unknown ids should return useful errors; requests to upload or access private bookmarks should explain the supported scope.

## Package and deploy

`plugins/examcooker/` contains the portable plugin manifest, HTTP MCP connection, original logo, navigation icon, and source-grounded study skill. The MCP URL points at `https://examcooker.acmvit.in/mcp`; deploy the changes there before expecting the new extension behavior. For another environment, use its public HTTPS endpoint in `mcp.json`.

The existing Next.js deployment serves both MCP and embedded UI. No schema migration is needed. Configure normal database secrets on the host and set `NEXT_PUBLIC_BASE_URL` to the public origin so citations, UI metadata, and icons agree.

The UI resource cache key is `ui://examcooker/resource-browser/v7.html`. Bump it for component contract changes. Cards use normal sans-serif labels and the website display titles; past papers show the course name with separate exam, slot, and year badges. Search returns these presentation fields in widget-only `_meta.cards`, retaining the standard citation results. The mixed search remains capped at 20 results; `_meta.filterResults` retains the complete per-type matches so a type tab does not hide matches excluded from the mixed list. The font is embedded in the HTML, so the CSP needs no external resource or API domains; tool calls go through the host bridge.

For local ChatGPT desktop packaging, register the MCP connection first. If the host requires a registered app mapping, add `.app.json` with the actual `plugin_asdk_app...` technical id and declare it under `extensions.com.openai.apps`; do not invent an id. Follow the official packaging guide for local/repo marketplace setup.

This package has not been submitted to the public directory. Before submission, verify the hosted endpoint in ChatGPT, provide screenshots and reviewer information, review the existing privacy/terms pages for this integration, and follow the official submission process. Local host-harness testing does not establish actual ChatGPT extension availability.

## Sources

- [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [Add UI](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Plugin Extensions](https://developers.openai.com/plugins/build/extensions)
- [Extension specification](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md)
- [Connect and test](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Package your plugin](https://developers.openai.com/plugins/build/plugins)
