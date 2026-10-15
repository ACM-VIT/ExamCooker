import assert from "node:assert/strict";
import { it } from "node:test";
import { Window, type HTMLInputElement, type HTMLButtonElement } from "happy-dom";
import { EXAMCOOKER_WIDGET_SCRIPT } from "./examcooker-widget-script";

type Message = { id?: string; method?: string; params?: { name?: string; arguments?: Record<string, string> } };
const source = (kind: string, id: string, title = id) => ({ id: `${kind}:${id}`, title, url: `https://examcooker.acmvit.in/${kind}/${id}` });
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

async function browser(t: { after: (fn: () => Promise<void>) => void }) {
  const window = new Window({ url: "https://widget.invalid", settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
  t.after(() => window.happyDOM.close());
  const messages: Message[] = [];
  const host = { postMessage: (message: Message) => { messages.push(message); } };
  Object.defineProperty(window, "parent", { value: host });
  window.document.body.innerHTML = '<div id="root"></div>';
  const send = (data: object) => window.dispatchEvent(new window.MessageEvent("message", { source: window.parent, data: { jsonrpc: "2.0", ...data } }));
  window.eval(EXAMCOOKER_WIDGET_SCRIPT);
  const initialize = messages.find((message) => message.method === "ui/initialize")!;
  send({ id: initialize.id, result: { hostCapabilities: {} } });
  await flush();
  const input = () => window.document.querySelector<HTMLInputElement>("#search-input")!;
  const click = (selector: string) => {
    const button = window.document.querySelector(selector) as HTMLButtonElement;
    assert.ok(button, selector);
    button.focus();
    button.click();
  };
  const search = async (query: string) => {
    input().value = query;
    input().dispatchEvent(new window.Event("input", { bubbles: true }));
    window.document.querySelector("#search-form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    return messages.filter((message) => message.method === "tools/call" && message.params?.name === "search").at(-1)!;
  };
  const result = async (message: Message, output: object, meta = {}) => {
    send({ id: message.id, result: { structuredContent: output, _meta: meta } });
    await flush();
  };
  const opening = async (output: object, meta = {}) => {
    send({ method: "ui/notifications/tool-result", params: { structuredContent: output, _meta: meta } });
    await flush();
  };
  const text = () => window.document.querySelector("#results")!.textContent!;
  const heading = () => window.document.querySelector("#results h2, #results h1")?.textContent;
  return { window, messages, input, click, search, result, opening, text, heading, send };
}

for (const openingDelivered of [false, true]) {
  it(`keeps a local search alive after host cancellation (opening delivered: ${openingDelivered})`, async (t) => {
    const b = await browser(t);
    if (openingDelivered) await b.opening({ view: "workspace", query: "", results: [] });
    const request = await b.search("calculus");
    b.send({ method: "ui/notifications/tool-cancelled", params: { reason: "user action" } });
    assert.match(b.text(), /Loading resources/);
    assert.equal(b.window.document.querySelector('[role="alert"]'), null);
    if (!openingDelivered) await b.opening({ query: "old query", results: [source("course", "old")] });
    await b.result(request, { results: [source("course", "new", "Calculus")] });
    assert.equal(b.heading(), "calculus");
    assert.equal(b.window.document.querySelectorAll(".card").length, 1);
    assert.match(b.text(), /Calculus/);
  });
}

it("keeps a deep-linked resource request alive after host cancellation", async (t) => {
  const b = await browser(t);
  b.send({ method: "ui/notifications/host-context-changed", params: { "openai/deepLink": { url: "/resource?id=course%3Aone" } } });
  await flush();
  const request = b.messages.find((message) => message.params?.name === "fetch")!;
  assert.ok(request);
  b.send({ method: "ui/notifications/tool-cancelled", params: {} });
  await b.result(request, { ...source("course", "one", "Deep-linked course"), text: "# Course\nDetails" });
  assert.equal(b.heading(), "Deep-linked course");
  assert.equal(b.window.document.querySelector('[role="alert"]'), null);
});

it("still reports cancellation when no local navigation has started", async (t) => {
  const b = await browser(t);
  b.send({ method: "ui/notifications/tool-cancelled", params: {} });
  assert.match(b.window.document.querySelector('[role="alert"]')!.textContent!, /request was cancelled/);
});

for (const draft of ["unsubmitted draft", ""]) {
  it(`preserves an edited opening draft (${draft ? "typed" : "cleared"})`, async (t) => {
    const b = await browser(t);
    const input = b.input();
    input.value = draft;
    input.dispatchEvent(new b.window.Event("input", { bubbles: true }));
    input.focus();
    input.setSelectionRange(0, draft.length);
    await b.opening({ view: "workspace", query: "opening query", results: [source("course", "one")] });
    assert.equal(b.input(), input);
    assert.equal(input.value, draft);
    assert.equal(b.window.document.activeElement, input);
    assert.equal(input.selectionEnd, draft.length);
    assert.equal(b.heading(), "opening query");
    assert.equal(b.window.document.querySelectorAll(".card").length, 1);
  });
}

it("uses the opening query when the search draft has not been edited", async (t) => {
  const b = await browser(t);
  await b.opening({ view: "workspace", query: "calculus", results: [] });
  assert.equal(b.input().value, "calculus");
});

it("keeps a pending first search alive when filters change", async (t) => {
  const b = await browser(t);
  const request = await b.search("calculus");
  b.click('[data-kind="note"]');
  assert.match(b.text(), /Loading resources/);
  await b.result(request, { results: [source("note", "limits", "Limits notes")] });
  assert.equal(b.heading(), "calculus");
  assert.match(b.text(), /Limits notes/);
});

it("discards stale searches and a late opening payload, then supports details and back", async (t) => {
  const b = await browser(t);
  const first = await b.search("first");
  const second = await b.search("second");
  await b.opening({ view: "workspace", query: "opening", results: [source("course", "old")], detail: null });
  await b.result(second, { results: [source("course", "latest", "Latest course")] });
  await b.result(first, { results: [source("course", "stale", "Stale course")] });
  assert.equal(b.heading(), "second");
  assert.ok(!b.text().includes("Stale course"));
  b.click('[data-action="open"]');
  await flush();
  const fetch = b.messages.filter((message) => message.params?.name === "fetch").at(-1)!;
  await b.result(fetch, { ...source("course", "latest", "Latest detail"), text: "# Latest detail\nDetails" });
  assert.equal(b.heading(), "Latest detail");
  b.click('[data-action="back"]');
  assert.equal(b.heading(), "second");
  assert.match(b.text(), /Latest course/);
});

it("preserves draft text, selection and keyboard focus through redraws", async (t) => {
  const b = await browser(t);
  await b.opening({ results: [source("course", "old")], query: "submitted" });
  const input = b.input();
  input.value = "unsubmitted draft";
  input.dispatchEvent(new b.window.Event("input", { bubbles: true }));
  input.focus();
  input.setSelectionRange(2, 5);
  b.click('[data-kind="note"]');
  assert.equal(b.input(), input);
  assert.equal(b.input().value, "unsubmitted draft");
  assert.equal(b.window.document.activeElement?.getAttribute("data-kind"), "note");
  input.focus();
  input.setSelectionRange(2, 5);
  b.window.dispatchEvent(new b.window.MessageEvent("message", { source: b.window.parent, data: { jsonrpc: "2.0", method: "ui/notifications/host-context-changed", params: { theme: "light" } } }));
  assert.equal(b.window.document.activeElement, input);
  assert.equal(input.selectionStart, 2);
  assert.equal(input.selectionEnd, 5);
});

it("filters complete per-type results beyond the mixed search cutoff", async (t) => {
  const b = await browser(t);
  const all = ["course", "past_paper", "note", "syllabus", "resource"].flatMap((kind) => Array.from({ length: 5 }, (_, i) => source(kind, `${kind}-${i}`)));
  const request = await b.search("all types");
  await b.result(request, { results: all.slice(0, 20) }, { filterResults: all });
  assert.equal(b.window.document.querySelectorAll(".card").length, 20);
  b.click('[data-kind="resource"]');
  assert.equal(b.window.document.querySelectorAll(".card").length, 5);
  assert.match(b.text(), /resource-4/);
});

it("cancels a pending detail on filter navigation without reviving that detail", async (t) => {
  const b = await browser(t);
  await b.opening({ results: [source("course", "one")] });
  b.click('[data-action="open"]');
  await flush();
  const fetch = b.messages.filter((message) => message.params?.name === "fetch").at(-1)!;
  b.click('[data-kind="course"]');
  await b.result(fetch, { ...source("course", "one"), text: "# Late detail" });
  assert.equal(b.window.document.querySelector("#results h1"), null);
  assert.equal(b.window.document.querySelectorAll(".card").length, 1);
});

it("renders every module URL without separator punctuation", async (t) => {
  const b = await browser(t);
  await b.opening({ ...source("course", "one"), text: "# One\nModule (reference: https://example.com/chapter, video: https://example.com/watch)." });
  const links = Array.from(b.window.document.querySelectorAll(".body-text a"), (link) => link.getAttribute("href"));
  assert.deepEqual(links, ["https://example.com/chapter", "https://example.com/watch"]);
});

it("preserves balanced URL parentheses while removing surrounding punctuation", async (t) => {
  const b = await browser(t);
  await b.opening({ ...source("course", "one"), text: "# One\nModule (reference: https://example.com/lecture_(1).pdf, video: https://example.com/topic_(part_(2))).\n[Notes](https://example.com/notes_(3))\nreference: https://example.com/encoded_%281%29.pdf" });
  const links = Array.from(b.window.document.querySelectorAll(".body-text a"), (link) => link.getAttribute("href"));
  assert.deepEqual(links, [
    "https://example.com/lecture_(1).pdf",
    "https://example.com/topic_(part_(2))",
    "https://example.com/notes_(3)",
    "https://example.com/encoded_%281%29.pdf",
  ]);
});
