# Voice study companion

The voice frontend uses `gpt-live-1` through the official `openai` SDK's Live API. GPT-Live handles speech; its managed Responses backend uses `gpt-5.6-terra` for reasoning and tool selection. The application executes tools and validates their arguments. This replaces the former Realtime Agents SDK integration; Live is a separate API, not a Realtime model-name override.

The model chooses how to teach based on the conversation. There is no application-imposed reply length, teaching sequence, output-token budget, or three-minute session cutoff. OpenAI's own session, model, and API limits still apply. The audio-reactive wave replaces live output captions and respects reduced-motion preferences.

## Setup

Use the existing server-side `OPENAI_API_KEY`, with access to `gpt-live-1` and `gpt-5.6-terra`. `OPENAI_PDF_QA_MODEL` remains the optional model override for document/image analysis (default `gpt-5.4-mini`). No database migration or new environment variable is required.

`POST /api/live/session` requires a signed-in user and accepts only an SDP offer. It builds the model, prompts, voice, and tool definitions on the server, then uses `client.live.create`. The browser never receives a project API key. The WebRTC client waits for `session.started`, streams microphone audio continuously, and receives audio through its remote media track. Ending sends `session.close` and waits for `session.closed`, with a timeout to release resources if finalization fails.

## Study tools

The retired `POST /api/realtime/session` endpoint returns a non-cacheable JSON 410 asking students to refresh. Keep it for previously loaded tabs: the old client displays raw error bodies, so removing the route exposes the entire Next.js HTML 404 in a toast. The Live client validates JSON session answers and replaces page payloads with short recovery messages.

- Search public courses, notes, past papers, syllabi, and module resources with `search_study_materials`.
- Fetch catalog details and analyze a catalog PDF with `read_study_material`. PDF URLs come from catalog records, not arbitrary client input. A result explicitly identifies whether the PDF was analyzed or only catalog metadata was returned.
- Analyze the currently rendered PDF page with `answer_question_about_open_pdf`, including diagrams and tables. The returned source page stays associated with the answer if the user navigates during analysis.
- Retain a freeform working note through `get_study_notes` / `save_study_notes`. Notes survive voice reconnects while the provider remains mounted; they are lost on reload and are not persistent progress tracking.
- Existing page, course, exam-filter, input, scrolling, and PDF navigation tools remain available.

Completed tool calls arrive inside `response.event`. `voice-live-responses.ts` collects calls from completed output-item events, returns every required function result, and sends one backend continuation. Terminal response snapshots may have empty output arrays. Duplicate call IDs are suppressed, and disconnect disposes pending batches so late results cannot feed a new session.

## Validation

Run:

```sh
pnpm exec next typegen
pnpm exec tsc --noEmit
node --import tsx --test app/components/voice/voice-runtime.test.ts app/components/voice/voice-live-responses.test.ts lib/voice/*.test.ts
pnpm dev
```

The repository's existing `pnpm lint` invokes removed `next lint` functionality and currently fails before linting.

Manual checks: start voice from a signed-in user action; discuss a concept; search a course and inspect its material; ask about an open PDF; interrupt, mute, end, and reconnect. Verify both the material/action result and the spoken explanation. The wave should respond to output audio, remain quiet while only the student speaks, and use a static shape with reduced motion enabled.

Implementation smoke checks used a synthetic microphone in an isolated local browser: real Live session startup, incoming audio, a delegated function call and continuation, microphone mute, reconnect, and graceful close. Catalog/PDF tools still need a signed-in application conversation to evaluate learning quality with representative course materials.

## Official references

- [Live migration](https://developers.openai.com/api/docs/guides/live-migration)
- [Live WebRTC setup](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live)
- [Delegation and function results](https://developers.openai.com/api/docs/guides/live-delegation)
- [Session lifecycle and graceful close](https://developers.openai.com/api/docs/guides/live-conversations)
- [Live prompting](https://developers.openai.com/api/docs/guides/live-prompting)
