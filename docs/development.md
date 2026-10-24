# Development

Use Node.js 24 and pnpm 12.8.1 (pinned in `package.json`).

```sh
git submodule update --init --recursive
pnpm install --frozen-lockfile
```

Before starting the app, create `.env` with `DATABASE_URL` for a development
CockroachDB database, `AUTH_SECRET` / `NEXTAUTH_SECRET`, and the provider settings
you need. Set `NEXTAUTH_URL` / `NEXT_PUBLIC_BASE_URL` to `http://localhost:3000`.
Google sign-in requires valid `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` values.
Never commit populated environment files.

## AI providers and models

The server-side text and PDF features use the task map in
`lib/ai/models.ts` and the provider factory in `lib/ai/provider.ts`. Set
`AI_PROVIDER=openai` (the default) with `OPENAI_API_KEY`, or set
`AI_PROVIDER=anthropic` with `ANTHROPIC_API_KEY` for a shared server credential.
When the selected credential is absent, signed-in users are prompted at the
first AI feature they invoke. They can supply their own OpenAI or Anthropic
key and choose a model for the current browser session. Settings are encrypted
in an HTTP-only cookie, bound to their account, and cleared on sign-out or
when the browser session ends. The key is never saved in the database. A configured
`AI_GATEWAY_API_KEY` can route a provider-qualified model for system requests
without an account. Account-triggered features require a direct provider key
and do not spend the shared gateway credential. A selected provider never
silently switches to another provider.

| Task | Override | OpenAI default | Anthropic default |
| --- | --- | --- | --- |
| Command palette intent | `AI_COMMAND_MODEL` | `gpt-6-luna` | `claude-haiku-5-5` |
| Upload moderation | `AI_MODERATION_MODEL` | `gpt-6-luna` | `claude-sonnet-5-5` |
| Correction review | `AI_CONTENT_CORRECTION_MODEL` | `gpt-6-luna` | `claude-sonnet-5-5` |
| Past-paper title | `AI_PAST_PAPER_TITLE_MODEL` | `gpt-6-luna` | `claude-haiku-5-5` |
| PDF question transcription | `AI_PDF_MARKDOWN_MODEL` | `gpt-6-luna` | `claude-sonnet-5-5` |
| Voice study document and visible-page analysis | `AI_VOICE_DOCUMENT_MODEL` | `gpt-6-luna` | `claude-sonnet-5-5` |

An override can be a model ID for the selected provider or a qualified ID
such as `anthropic/claude-opus-5-5`. The older `OPENAI_COMMAND_MODEL` remains
a fallback for the command Worker only when its provider is OpenAI. Changing
the PDF transcription model changes its cache identity; changing the command
model separates its semantic-cache entries.

Anthropic's [model list](https://platform.claude.com/docs/en/models/overview)
(checked 22 October 2026)
also includes `claude-opus-5-5` for more demanding work and
`claude-fable-5-1` for the most demanding reasoning. Both can be selected with
a qualified override. Check the model list again before changing defaults.

The command palette runs in a separate Worker. The web action forwards the
current account's session provider, model, and key to that Worker for each
intent request. Its `AI_PROVIDER` in `worker/wrangler.jsonc` and a Worker secret
are only needed for callers that do not use a web session.
OpenAI embeddings remain optional for its semantic cache; without
`OPENAI_API_KEY`, the command resolver still works through Anthropic but skips
embedding-based cache lookups. The `OPENAI_EMBEDDING_MODEL` setting remains
OpenAI-specific.

Voice sessions use OpenAI's Live API, including its managed Responses backend.
Their models are listed in `lib/ai/models.ts`, and a voice session requires
an OpenAI key, even when the text-feature provider is Anthropic. Users are
prompted for one when they start voice study if none is available. Its PDF and
visible-page study tools use the shared text provider; `OPENAI_PDF_QA_MODEL`
remains a legacy override for these tools only when OpenAI is selected.

Start the app with `pnpm dev` after configuring the environment.

`pnpm dev` and `pnpm build` generate the MCP appearance module, copy PDFium
assets, and refresh course data before running Next.js. The course sync falls
back to the checked-in dataset when its upstream is unavailable.

## Commands

- `pnpm build` / `pnpm start`: build and serve the app.
- `pnpm exec tsc --noEmit`: check web types.
- `pnpm mcp:test`: run MCP tests.
- `pnpm exec tsx --test path/to/module.test.ts`: run a focused test.
- `pnpm cli:build`: build the CLI.
- `pnpm exec tsx packages/cli/src/cli.ts --help`: run the CLI from source.
- `pnpm --filter examcooker typecheck`: check CLI types.

There is no ESLint setup. Next.js 16 removed `next lint`.
Exercise changed pages and API routes with the dev server as well.

## Layout

`app/` holds routes and components; `lib/` holds shared logic and tests.
Database clients, queries, and schema live in `db/`, with migrations in
`drizzle/`. The CLI is in `packages/cli/`; Cloudflare Workers and adapters are
in `cloudflare/` and `worker/`.

Seed and backfill commands remain in `scripts/`. Check their target database
and dry-run options before running them.
