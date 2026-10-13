import { McpServer } from "@modelcontextprotocol/server";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import type {
  McpFetchOutput,
  McpSearchOutput,
} from "@/lib/mcp/examcooker-resources";
import {
  EXAMCOOKER_WIDGET_HTML,
  EXAMCOOKER_WIDGET_URI,
} from "@/lib/mcp/examcooker-widget";
import { absoluteUrl, getBaseUrl } from "@/lib/seo";

// Lazy data loading lets discovery and the empty workspace start without a
// database connection. The injectable boundary also permits protocol tests.
export type ExamCookerResources = {
  search: (query: string) => Promise<McpSearchOutput>;
  fetch: (id: string) => Promise<McpFetchOutput | null>;
};
const defaultResources: ExamCookerResources = {
  search: async (query) =>
    (await import("./examcooker-resources")).searchExamCookerResources(query),
  fetch: async (id) =>
    (await import("./examcooker-resources")).fetchExamCookerResource(id),
};
const annotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
} as const;
const searchSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.url(),
});
const fetchSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  url: z.url(),
  metadata: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
});
const querySchema = z
  .string()
  .trim()
  .max(240)
  .describe(
    "Course code, subject, exam type, year, or resource keyword; empty lists popular courses.",
  );
const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .describe(
    "A stable id returned by search, course code, or canonical ExamCooker URL.",
  );

function jsonResult(
  output: Record<string, unknown>,
  meta?: Record<string, unknown>,
): CallToolResult {
  return {
    structuredContent: output,
    content: [{ type: "text", text: JSON.stringify(output) }],
    ...(meta ? { _meta: meta } : {}),
  };
}
function notFound(id: string): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({
          id,
          error:
            "No public ExamCooker resource was found for this id. Search again for a valid resource.",
        }),
      },
    ],
  };
}
async function withResourceErrors(
  action: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await action();
  } catch {
    // Never return database errors, connection strings, or stack traces.
    console.error("ExamCooker MCP resource request failed");
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "ExamCooker could not load these resources. Please retry shortly.",
        },
      ],
    };
  }
}

export function createExamCookerMcpServer(
  resources: ExamCookerResources = defaultResources,
) {
  const icons = [
    {
      src: absoluteUrl("/examcooker-plugin.svg"),
      mimeType: "image/svg+xml",
      sizes: ["any"],
    },
  ];
  const server = new McpServer(
    {
      name: "examcooker",
      title: "ExamCooker",
      version: "0.3.0",
      websiteUrl: getBaseUrl(),
      icons,
      description:
        "Search and browse VIT courses, past papers, notes, syllabi, and resources.",
    },
    {
      capabilities: {
        extensions: {
          "openai/mentions": { searchTool: "search_resource_mentions" },
        },
      },
      instructions:
        "Search public ExamCooker resources, then fetch stable ids for source details and citations. Use open_study_workspace when the user wants to browse or collect resources visually. PDF links and catalog metadata are not extracted PDF contents: do not claim to have read a PDF or invent its questions. The resource currently open in the browser can be attached to model context. No private account access or uploads are available.",
    },
  );
  registerAppResource(
    server,
    "ExamCooker resource browser",
    EXAMCOOKER_WIDGET_URI,
    {
      description: "Search, filter and inspect ExamCooker study resources.",
    },
    async () => ({
      contents: [
        {
          uri: EXAMCOOKER_WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: EXAMCOOKER_WIDGET_HTML,
          _meta: {
            ui: {
              domain: getBaseUrl(),
              prefersBorder: true,
              csp: {
                connectDomains: [],
                resourceDomains: [
                  "https://fonts.googleapis.com",
                  "https://fonts.gstatic.com",
                ],
              },
            },
            "openai/ui": { availableDisplayModes: ["inline", "fullscreen"] },
            "openai/widgetDescription":
              "Compact ExamCooker resource browser with course search, resource-type filters, and source details. Open a resource to attach its source to the conversation.",
          },
        },
      ],
    }),
  );

  // Data tools don't remount the workspace; knowledge clients keep the standard contract.
  server.registerTool(
    "search",
    {
      title: "Search ExamCooker",
      description:
        "Use this when the user wants VIT courses, notes, past papers, syllabi, or module resources. Search by course code, subject, exam type, year, or keyword. Returns stable ids and citation URLs; fetch selected ids for details.",
      inputSchema: z.object({ query: querySchema }),
      outputSchema: z.object({ results: z.array(searchSchema) }),
      annotations,
      _meta: {
        ui: { visibility: ["model", "app"] },
        securitySchemes: [{ type: "noauth" }],
        "openai/toolInvocation/invoking": "Searching ExamCooker",
        "openai/toolInvocation/invoked": "Resources found",
      },
    },
    async ({ query }) =>
      withResourceErrors(async () => {
        const { results, cards } = await resources.search(query);
        return jsonResult({ results }, { query, ...(cards ? { cards } : {}) });
      }),
  );
  server.registerTool(
    "fetch",
    {
      title: "Fetch ExamCooker resource",
      description:
        "Use this when the user wants details or a citation for a public ExamCooker resource found by search. Accepts a result id, course code, or canonical ExamCooker URL. Returns catalog text and PDF links, not extracted PDF contents.",
      inputSchema: z.object({ id: idSchema }),
      outputSchema: fetchSchema,
      annotations,
      _meta: {
        ui: { visibility: ["model", "app"] },
        securitySchemes: [{ type: "noauth" }],
        "openai/toolInvocation/invoking": "Loading resource",
        "openai/toolInvocation/invoked": "Resource loaded",
      },
    },
    async ({ id }) =>
      withResourceErrors(async () => {
        const output = await resources.fetch(id);
        return output ? jsonResult(output) : notFound(id);
      }),
  );
  registerAppTool(
    server,
    "open_study_workspace",
    {
      // This SDK version uses serverInfo.icons as the entrypoint icon fallback.
      title: "ExamCooker",
      description:
        "Use this when the user wants to browse ExamCooker visually or open a study resource. Opens the compact resource browser. Optionally pass a search query or a resourceId already found by search; no prerequisites for an empty workspace.",
      inputSchema: z.object({
        query: querySchema.optional(),
        resourceId: idSchema.optional(),
      }),
      outputSchema: z.object({
        view: z.literal("workspace"),
        query: z.string(),
        results: z.array(searchSchema),
        detail: fetchSchema.nullable(),
      }),
      annotations,
      _meta: {
        ui: {
          resourceUri: EXAMCOOKER_WIDGET_URI,
          visibility: ["model", "app"],
        },
        "openai/outputTemplate": EXAMCOOKER_WIDGET_URI,
        "openai/ui": { entrypoints: [{ type: "global" }, { type: "thread" }] },
        securitySchemes: [{ type: "noauth" }],
        "openai/toolInvocation/invoking": "Opening ExamCooker",
        "openai/toolInvocation/invoked": "ExamCooker ready",
      },
    },
    async ({ query, resourceId }) =>
      withResourceErrors(async () => {
        const [search, detail] = await Promise.all([
          query !== undefined
            ? resources.search(query)
            : Promise.resolve<McpSearchOutput>({ results: [] }),
          resourceId ? resources.fetch(resourceId) : Promise.resolve(null),
        ]);
        if (resourceId && !detail) return notFound(resourceId);
        return jsonResult(
          {
            view: "workspace",
            query: query ?? "",
            results: search.results,
            detail,
          },
          search.cards ? { cards: search.cards } : undefined,
        );
      }),
  );
  // The legacy metadata alias remains for older hosts.
  server.registerTool(
    "search_resource_mentions",
    {
      title: "Mention an ExamCooker resource",
      description:
        "Use this when the composer needs ExamCooker resource suggestions for an at-mention.",
      inputSchema: z.object({ query: querySchema }),
      outputSchema: z.object({
        items: z.array(
          z.object({
            type: z.literal("resource_link"),
            uri: z.string(),
            name: z.string(),
            description: z.string(),
          }),
        ),
      }),
      annotations,
      _meta: {
        ui: { visibility: ["app"] },
        "openai/extensions": { "mentions/search": {} },
        securitySchemes: [{ type: "noauth" }],
      },
    },
    async ({ query }) =>
      withResourceErrors(async () => {
        const output = await resources.search(query);
        return {
          content: [],
          structuredContent: {
            items: output.results.slice(0, 10).map((item) => ({
              type: "resource_link",
              uri: item.url,
              name: item.title,
              description: `Public ExamCooker resource. Use fetch with id ${item.id} for details.`,
            })),
          },
        };
      }),
  );
  return server;
}
