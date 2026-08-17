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
    addEventListener: (name: string, listener: (event: { data: unknown }) => void) => {
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

const harness = createWidgetHarness();
harness.dispatch({
  jsonrpc: "2.0",
  method: "tool-result",
  params: {
    structuredContent: {
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      items: [
        {
          id: "course:CS101",
          code: "CS101",
          title: "Operating Systems",
          paperCount: 3,
          noteCount: 2,
          url: "https://examcooker.acmvit.in/courses/CS101",
        },
      ],
    },
  },
});

assert.match(harness.root.innerHTML, /Operating Systems/);
assert.doesNotMatch(harness.root.innerHTML, /Loading ExamCooker resource/);

console.log("MCP catalog widget test passed");
