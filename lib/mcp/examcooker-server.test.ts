import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Script } from "node:vm";
import { readFileSync } from "node:fs";
import {
  EXAMCOOKER_CATALOG_CSS,
  EXAMCOOKER_FONT_CSS,
} from "./generated/website-appearance";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { NextRequest } from "next/server";
import { POST, OPTIONS } from "@/app/mcp/route";
import { createExamCookerMcpServer } from "./examcooker-server";
import {
  EXAMCOOKER_WIDGET_HTML,
  EXAMCOOKER_WIDGET_URI,
} from "./examcooker-widget";
import { EXAMCOOKER_WIDGET_SCRIPT } from "./examcooker-widget-script";

const source = {
  id: "course:BMAT101L",
  title: "Course: BMAT101L - Calculus",
  url: "https://examcooker.acmvit.in/past_papers/BMAT101L",
};
const detail = {
  ...source,
  text: "# Calculus\n## Module resources\n- Limits and derivatives",
  metadata: { type: "course", paperCount: 4 },
};
const cards = { [source.id]: { title: "Calculus", courseCode: "BMAT101L", paperCount: 4 } };
const filterResults = [source, { id: "resource:extra", title: "Extra module resources", url: "https://examcooker.acmvit.in/resources/extra" }];
let searches = 0;
const server = createExamCookerMcpServer({
  search: async (query) => {
    searches++;
    if (query === "unavailable") throw new Error("secret-database-connection");
    return { results: query === "no matches" ? [] : [source], cards, filterResults };
  },
  fetch: async (id) => (id === source.id ? detail : null),
});
const client = new Client({
  name: "examcooker-contract-test",
  version: "1.0.0",
});

describe("ExamCooker plugin protocol", () => {
  before(async () => {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });
  after(async () => {
    await client.close();
    await server.close();
  });

  it("advertises data tools, sidebar/thread entrypoints, and app-only composer mentions", async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(
      tools.map((tool) => tool.name),
      ["search", "fetch", "open_study_workspace", "search_resource_mentions"],
    );
    for (const tool of tools) {
      assert.equal(tool.annotations?.readOnlyHint, true);
      assert.equal(tool.annotations?.destructiveHint, false);
      assert.equal(tool.annotations?.idempotentHint, true);
    }
    assert.equal(tools[0]._meta?.["openai/outputTemplate"], undefined);
    assert.deepEqual(tools[2]._meta?.["openai/ui"], {
      entrypoints: [{ type: "global" }, { type: "thread" }],
    });
    assert.deepEqual(tools[3]._meta?.["openai/extensions"], {
      "mentions/search": {},
    });
    assert.deepEqual(tools[3]._meta?.ui, { visibility: ["app"] });
    assert.ok(client.getServerVersion()?.icons?.length);
    assert.deepEqual(client.getServerCapabilities()?.extensions?.["openai/mentions"], {
      searchTool: "search_resource_mentions",
    });
  });

  it("opens with empty arguments and performs no catalog request", async () => {
    const beforeCount = searches;
    const result = await client.callTool({
      name: "open_study_workspace",
      arguments: {},
    });
    assert.deepEqual(result.structuredContent, {
      view: "workspace",
      query: "",
      results: [],
      detail: null,
    });
    assert.equal(searches, beforeCount);
  });

  it("keeps the standard search/fetch single-text JSON contract", async () => {
    for (const [name, args, expected] of [
      ["search", { query: "Calculus" }, { results: [source] }],
      ["fetch", { id: source.id }, detail],
    ] as const) {
      const result = await client.callTool({ name, arguments: args });
      assert.deepEqual(result.structuredContent, expected);
      const content = result.content as Array<{ type: string; text: string }>;
      assert.equal(content.length, 1);
      assert.equal(content[0].type, "text");
      assert.deepEqual(JSON.parse(content[0].text), expected);
    }
  });

  it("sends display titles only to the widget while retaining citation titles", async () => {
    for (const name of ["search", "open_study_workspace"]) {
      const result = await client.callTool({ name, arguments: { query: "Calculus" } });
      assert.deepEqual(result._meta?.cards, cards);
      assert.deepEqual(result._meta?.filterResults, filterResults);
      const output = result.structuredContent as { results: typeof source[]; cards?: unknown };
      assert.deepEqual(output.results, [source]);
      assert.equal(output.cards, undefined);
      assert.equal("filterResults" in output, false);
      assert.equal(JSON.parse((result.content as Array<{ text: string }>)[0].text).cards, undefined);
    }
  });

  it("preloads a query and selected resource without changing the data contract", async () => {
    const result = await client.callTool({
      name: "open_study_workspace",
      arguments: { query: "Calculus", resourceId: source.id },
    });
    assert.deepEqual(result.structuredContent, {
      view: "workspace",
      query: "Calculus",
      results: [source],
      detail,
    });
  });

  it("returns resource links for mentions and empty results for missing searches", async () => {
    const result = await client.callTool({
      name: "search_resource_mentions",
      arguments: { query: "Calculus" },
    });
    const items = (
      result.structuredContent as {
        items: Array<{ type: string; uri: string }>;
      }
    ).items;
    assert.equal(items[0].type, "resource_link");
    assert.equal(items[0].uri, source.url);
    const empty = await client.callTool({
      name: "search",
      arguments: { query: "no matches" },
    });
    assert.deepEqual(empty.structuredContent, { results: [] });
  });

  it("handles invalid input, unknown ids, and provider failures without revealing internals", async () => {
    for (const request of [
      { name: "search", arguments: { query: "x".repeat(241) } },
      { name: "fetch", arguments: { id: "" } },
      { name: "fetch", arguments: { id: "missing" } },
      { name: "open_study_workspace", arguments: { resourceId: "missing" } },
      { name: "search", arguments: { query: "unavailable" } },
    ]) {
      const result = await client.callTool(request);
      assert.equal(result.isError, true);
      assert.ok(!JSON.stringify(result).includes("secret-database-connection"));
    }
  });

  it("serves versioned UI without external resource or connection permissions", async () => {
    const result = await client.readResource({ uri: EXAMCOOKER_WIDGET_URI });
    const content = result.contents[0];
    assert.equal(content.mimeType, "text/html;profile=mcp-app");
    assert.ok("text" in content);
    assert.equal(content.text, EXAMCOOKER_WIDGET_HTML);
    assert.deepEqual(
      content._meta?.ui && (content._meta.ui as { csp: unknown }).csp,
      {
        connectDomains: [],
        resourceDomains: [],
      },
    );
    assert.doesNotThrow(() => new Script(EXAMCOOKER_WIDGET_SCRIPT));
    assert.ok(!EXAMCOOKER_WIDGET_HTML.includes('src="https://'));
  });

  it("embeds the website stylesheet and font without a network dependency", () => {
    const shared = readFileSync(
      "app/components/common/catalog-appearance.css",
      "utf8",
    );
    assert.equal(EXAMCOOKER_CATALOG_CSS, shared);
    assert.ok(EXAMCOOKER_WIDGET_HTML.includes(shared));
    const encodedFont = EXAMCOOKER_FONT_CSS.match(/base64,([^)]*)/);
    assert.ok(encodedFont);
    assert.deepEqual(
      Buffer.from(encodedFont[1], "base64"),
      readFileSync("public/assets/fonts/plus-jakarta-sans-bold.woff2"),
    );
    assert.ok(EXAMCOOKER_WIDGET_HTML.includes(EXAMCOOKER_FONT_CSS));
    assert.ok(!EXAMCOOKER_WIDGET_HTML.includes("fonts.googleapis.com"));
  });
});

describe("stateless /mcp route", () => {
  const request = (message: object) =>
    new NextRequest("http://localhost:3000/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(message),
    });
  it("initializes and serves tools across independent HTTP requests", async () => {
    const initialize = await POST(
      request({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "http-test", version: "1" },
        },
      }),
    );
    assert.equal(initialize.status, 200);
    assert.equal(
      (await initialize.json()).result.serverInfo.name,
      "examcooker",
    );
    const listed = await POST(
      request({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    );
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).result.tools.length, 4);
    assert.equal(listed.headers.get("Cache-Control"), "no-store");
    assert.equal(listed.headers.get("Access-Control-Allow-Origin"), "*");
    const opened = await POST(
      request({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "open_study_workspace", arguments: {} },
      }),
    );
    assert.equal(
      (await opened.json()).result.structuredContent.view,
      "workspace",
    );
  });
  it("logs a redacted transport cause while returning a generic response", async (t) => {
    const cause = Object.assign(new Error("connection interrupted postgres://user:private@db.invalid/study"), { code: "ECONNRESET" });
    t.mock.method(WebStandardStreamableHTTPServerTransport.prototype, "handleRequest", async () => { throw new Error("Transport failed", { cause }); });
    const logs = t.mock.method(console, "error", () => {});
    const response = await POST(new NextRequest("https://examcooker.acmvit.in/mcp", { method: "POST" }));
    assert.equal(response.status, 500);
    const body = JSON.stringify(await response.json());
    assert.ok(!body.includes("ECONNRESET"));
    const diagnostic = JSON.stringify(logs.mock.calls[0].arguments);
    assert.match(diagnostic, /Transport failed/);
    assert.match(diagnostic, /ECONNRESET/);
    assert.ok(!diagnostic.includes("user:private"));
  });

  it("allows MCP browser preflight", () => {
    const response = OPTIONS();
    assert.equal(response.status, 204);
    assert.ok(
      response.headers
        .get("Access-Control-Allow-Headers")
        ?.includes("MCP-Protocol-Version"),
    );
  });
});
