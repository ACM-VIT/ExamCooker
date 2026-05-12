import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  fetchExamCookerResource,
  searchExamCookerResources,
} from "@/lib/mcp/examcooker-resources";

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
      websiteUrl: "https://examcooker.acmvit.in",
      description:
        "Read-only access to ExamCooker courses, notes, past papers, syllabi, and module resources.",
    },
    {
      instructions:
        "Use search to find public ExamCooker study resources, then use fetch with an id or ExamCooker URL to retrieve the selected resource. Do not expect authentication or private user data.",
    },
  );

  server.registerTool(
    "search",
    {
      title: "Search ExamCooker",
      description:
        "Use this when the user wants to find public ExamCooker courses, notes, past papers, syllabi, or module resources by course code, subject, exam type, year, or keyword.",
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

  server.registerTool(
    "fetch",
    {
      title: "Fetch ExamCooker Resource",
      description:
        "Use this when the user wants the details for one public ExamCooker resource returned by search, or when they provide an ExamCooker course code or resource URL.",
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
