import assert from "node:assert/strict";
import vm from "node:vm";
import { EXAMCOOKER_WIDGET_HTML } from "../lib/mcp/examcooker-widget";

type WidgetWindow = {
  innerWidth: number;
  location: { href: string };
  parent: { postMessage: () => undefined };
  addEventListener: (name: string, listener: (event: { data: unknown }) => void) => void;
  window?: WidgetWindow;
};

function extractWidgetScript(html: string) {
  const start = html.indexOf("<script>");
  const end = html.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start, "widget script should be present");
  return html.slice(start + "<script>".length, end);
}

function createWidgetHarness() {
  const listeners = new Map<string, (event: { data: unknown }) => void>();
  const root = {
    innerHTML:
      '<div class="status" role="status" aria-live="polite"><div class="spinner"></div>Loading ExamCooker resource…</div>',
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const documentElement = {
    style: { height: "" },
    getBoundingClientRect: () => ({ height: 200 }),
  };
  const document = {
    body: {},
    documentElement,
    fonts: undefined,
    getElementById: (id: string) => (id === "root" ? root : null),
  };
  const window: WidgetWindow = {
    innerWidth: 390,
    location: { href: "https://examcooker.acmvit.in/" },
    parent: { postMessage: () => undefined },
    addEventListener: (name, listener) => {
      listeners.set(name, listener);
    },
  };
  const context = {
    Array,
    Error,
    JSON,
    Map,
    Math,
    Number,
    Object,
    Promise,
    RegExp,
    Set,
    String,
    URL,
    clearTimeout: () => undefined,
    console,
    document,
    requestAnimationFrame: (callback: () => void) => callback(),
    setTimeout: () => 0,
    window,
    ResizeObserver: class {
      observe() {}
    },
  };

  window.window = window;
  vm.runInNewContext(extractWidgetScript(EXAMCOOKER_WIDGET_HTML), context);

  return {
    root,
    dispatch(data: unknown) {
      const listener = listeners.get("message");
      assert.ok(listener, "widget message listener should be registered");
      listener({ data });
    },
  };
}

function renderDetail(text: string) {
  const harness = createWidgetHarness();
  harness.dispatch({
    jsonrpc: "2.0",
    method: "tool-result",
    params: {
      structuredContent: {
        id: "past_paper:paper-1",
        title: "BCSE305L - Embedded Systems - CAT-1 - Slot A1 - 2023",
        url: "https://examcooker.acmvit.in/past_papers/BCSE305L/paper/paper-1",
        text,
        metadata: {
          type: "past_paper",
          courseCode: "BCSE305L",
          year: 2023,
          fileUrl: "https://examcooker.acmvit.in/papers/paper-1.pdf",
        },
      },
    },
  });
  return harness.root.innerHTML;
}

const paperHtml = renderDetail([
  "# BCSE305L - Embedded Systems - CAT-1 - Slot A1 - 2023",
  "Course: BCSE305L",
  "Course title: Embedded Systems",
  "Exam type: CAT-1",
  "Year: 2023",
  "Slot: A1",
  "Semester: FALL",
  "Campus: VELLORE",
  "Answer key: no",
].join("\n"));

for (const qualifier of ["Exam type: CAT-1", "Slot: A1", "Semester: FALL", "Campus: VELLORE", "Answer key: no"]) {
  assert.match(paperHtml, new RegExp(qualifier.replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&")));
}

const repeatedHtml = renderDetail([
  "# Operating Systems resources",
  "## Papers",
  "- None",
  "## Notes",
  "- None",
  "## Module 1",
  "- reference: https://example.com/reference",
  "## Module 2",
  "- reference: https://example.com/reference",
].join("\n"));

assert.equal((repeatedHtml.match(/>None</g) || []).length, 2);
assert.equal((repeatedHtml.match(/https:\/\/example\.com\/reference/g) || []).length, 2);

console.log("MCP widget detail tests passed");
