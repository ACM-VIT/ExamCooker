import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import {
  fetchExamCookerResource,
  searchExamCookerResources,
} from "@/lib/mcp/examcooker-resources";
import {
  EXAMCOOKER_WIDGET_HTML,
  EXAMCOOKER_WIDGET_URI,
} from "@/lib/mcp/examcooker-widget";

const WIDGET_DOMAIN = "https://examcooker.acmvit.in";

const WIDGET_UI_META = {
  domain: WIDGET_DOMAIN,
  prefersBorder: true,
  csp: {
    connectDomains: [] as string[],
    resourceDomains: [
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
    ] as string[],
  },
} as const;

const ToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
} as const;

const SearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
});

const SearchOutputSchema = {
  results: z.array(SearchResultSchema),
};

const FetchOutputSchema = {
  id: z.string(),
  title: z.string(),
  text: z.string(),
  url: z.string().url(),
  metadata: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
};

export function createExamCookerMcpServer() {
  const server = new McpServer(
    {
      name: "examcooker",
      title: "ExamCooker",
      version: "0.1.0",
      websiteUrl: WIDGET_DOMAIN,
      description:
        "Read-only access to ExamCooker courses, notes, past papers, syllabi, and module resources.",
    },
    {
      instructions:
        "Use search to find public ExamCooker study resources, then use fetch with an id or ExamCooker URL to retrieve the selected resource. Do not expect authentication or private user data.",
    },
  );

  registerAppResource(
    server,
    "ExamCooker widget",
    EXAMCOOKER_WIDGET_URI,
    {
      description:
        "Renders ExamCooker search results and resource detail cards inside ChatGPT.",
    },
    async () => ({
      contents: [
        {
          uri: EXAMCOOKER_WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: EXAMCOOKER_WIDGET_HTML,
          _meta: {
            ui: WIDGET_UI_META,
            "openai/widgetDescription":
              "Shows ExamCooker search results or a selected resource (course, past paper, note, or syllabus) with a link out to ExamCooker.",
          },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "search",
    {
      title: "Search ExamCooker",
      description:
        "Search the public ExamCooker catalog for courses, notes, past papers, syllabi, and module resources by course code, subject, exam type, year, or keyword. Returns a ranked list of matching resources with stable ids and canonical ExamCooker URLs.",
      inputSchema: {
        query: z
          .string()
          .trim()
          .max(240)
          .describe("Search terms such as a course code, subject, exam type, year, or resource keyword."),
      },
      outputSchema: SearchOutputSchema,
      annotations: ToolAnnotations,
      _meta: {
        ui: { resourceUri: EXAMCOOKER_WIDGET_URI },
        "openai/outputTemplate": EXAMCOOKER_WIDGET_URI,
        "openai/toolInvocation/invoking": "Searching ExamCooker",
        "openai/toolInvocation/invoked": "Found ExamCooker resources",
      },
    },
    async ({ query }) => {
      const output = await searchExamCookerResources(query);
      return {
        structuredContent: output,
        content: [
          {
            type: "text",
            text: JSON.stringify(output),
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    "fetch",
    {
      title: "Fetch ExamCooker Resource",
      description:
        "Fetch the full details of a single public ExamCooker resource (course, past paper, note, syllabus, or module resource). Accepts a search-result id, a course code, or a canonical ExamCooker URL.",
      inputSchema: {
        id: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .describe("A search result id, course code, or ExamCooker resource URL."),
      },
      outputSchema: FetchOutputSchema,
      annotations: ToolAnnotations,
      _meta: {
        ui: { resourceUri: EXAMCOOKER_WIDGET_URI },
        "openai/outputTemplate": EXAMCOOKER_WIDGET_URI,
        "openai/toolInvocation/invoking": "Fetching ExamCooker resource",
        "openai/toolInvocation/invoked": "Fetched ExamCooker resource",
      },
    },
    async ({ id }) => {
      const output = await fetchExamCookerResource(id);

      if (!output) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id,
                error: "No public ExamCooker resource was found for this id.",
              }),
            },
          ],
        };
      }

      return {
        structuredContent: output,
        content: [
          {
            type: "text",
            text: JSON.stringify(output),
          },
        ],
      };
    },
  );

  return server;
}
