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
  type McpAsset,
  type McpFetchOutput,
} from "@/lib/mcp/examcooker-resources";
import {
  listMcpCourses,
  listMcpNotes,
  listMcpPastPapers,
  listMcpResources,
  listMcpSyllabi,
} from "@/lib/mcp/examcooker-catalog";
import { parseResourceRef, toResourceId } from "@/lib/mcp/resource-id";
import { campusValues, examTypeValues, semesterValues } from "@/db";
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

const AssetSchema = z.object({
  uri: z.string().url(),
  name: z.string(),
  mimeType: z.string(),
  description: z.string().optional(),
});

const FetchOutputSchema = {
  id: z.string(),
  title: z.string(),
  text: z.string(),
  url: z.string().url(),
  pdfUrl: z.string().url().optional(),
  imageUrls: z.array(z.string().url()).optional(),
  assets: z.array(AssetSchema).optional(),
  metadata: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
};

const PaginationInputSchema = {
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
};

const CourseItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  paperCount: z.number().int().nonnegative(),
  noteCount: z.number().int().nonnegative(),
  url: z.string().url(),
});

const NoteItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  courseCode: z.string().nullable(),
  courseTitle: z.string().nullable(),
  url: z.string().url(),
});

const PastPaperItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  course: z
    .object({
      code: z.string(),
      title: z.string().nullable(),
    })
    .nullable(),
  examType: z.enum(examTypeValues).nullable(),
  examTypeLabel: z.string().nullable(),
  year: z.number().int().nullable(),
  slot: z.string().nullable(),
  semester: z.enum(semesterValues).nullable(),
  campus: z.enum(campusValues).nullable(),
  hasAnswerKey: z.boolean().nullable(),
});

const SyllabusItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  courseCode: z.string().nullable(),
  courseName: z.string().nullable(),
  url: z.string().url(),
});

const ResourceItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  courseCode: z.string().nullable(),
  courseName: z.string().nullable(),
  year: z.string().nullable(),
  url: z.string().url(),
});

const PageOutputFields = {
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(50),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().min(1),
  hasNextPage: z.boolean(),
};

const CoursesOutputSchema = {
  ...PageOutputFields,
  items: z.array(CourseItemSchema),
};

const NotesOutputSchema = {
  ...PageOutputFields,
  items: z.array(NoteItemSchema),
};

const PastPapersOutputSchema = {
  ...PageOutputFields,
  items: z.array(PastPaperItemSchema),
};

const SyllabiOutputSchema = {
  ...PageOutputFields,
  items: z.array(SyllabusItemSchema),
};

const ResourcesOutputSchema = {
  ...PageOutputFields,
  items: z.array(ResourceItemSchema),
};

const CatalogToolMeta = {
  ui: { resourceUri: EXAMCOOKER_WIDGET_URI },
  "openai/outputTemplate": EXAMCOOKER_WIDGET_URI,
} as const;
function fetchContent(output: McpFetchOutput) {
  const links = (output.assets ?? []).map((asset: McpAsset) => ({
    type: "resource_link" as const,
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType,
    ...(asset.description ? { description: asset.description } : {}),
  }));

  return [
    {
      type: "text" as const,
      text: JSON.stringify(output),
    },
    ...links,
  ];
}

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
        content: fetchContent(output),
      };
    },
  );

  registerAppTool(
    server,
    "list_courses",
    {
      title: "List ExamCooker Courses",
      description:
        "Search the public ExamCooker course catalog by code, title, or alias. Supports pagination and optional filters for courses that have published papers or notes.",
      inputSchema: {
        query: z.string().trim().max(240).optional(),
        withPapers: z.boolean().optional(),
        withNotes: z.boolean().optional(),
        ...PaginationInputSchema,
      },
      outputSchema: CoursesOutputSchema,
      annotations: ToolAnnotations,
      _meta: {
        ...CatalogToolMeta,
        "openai/toolInvocation/invoking": "Listing ExamCooker courses",
        "openai/toolInvocation/invoked": "Listed ExamCooker courses",
      },
    },
    async (input) => {
      const output = await listMcpCourses(input);
      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output) }],
      };
    },
  );

  registerAppTool(
    server,
    "list_notes",
    {
      title: "List ExamCooker Notes",
      description:
        "Browse published ExamCooker notes, optionally filtered by search text or course code, with stable note ids and canonical note URLs.",
      inputSchema: {
        query: z.string().trim().max(240).optional(),
        courseCode: z.string().trim().max(40).optional(),
        ...PaginationInputSchema,
      },
      outputSchema: NotesOutputSchema,
      annotations: ToolAnnotations,
      _meta: {
        ...CatalogToolMeta,
        "openai/toolInvocation/invoking": "Listing ExamCooker notes",
        "openai/toolInvocation/invoked": "Listed ExamCooker notes",
      },
    },
    async (input) => {
      const output = await listMcpNotes(input);
      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output) }],
      };
    },
  );

  registerAppTool(
    server,
    "list_past_papers",
    {
      title: "Search ExamCooker Past Papers",
      description:
        "Search published ExamCooker past papers with filters for course, exam type, year, slot, semester, campus, answer-key availability, and tags.",
      inputSchema: {
        query: z.string().trim().max(240).optional(),
        course: z.string().trim().max(80).optional(),
        examType: z.enum(examTypeValues).optional(),
        year: z.number().int().min(2000).max(2100).optional(),
        slot: z.string().trim().max(20).optional(),
        semester: z.enum(semesterValues).optional(),
        campus: z.enum(campusValues).optional(),
        answerKeysOnly: z.boolean().optional(),
        tags: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
        tagMode: z.enum(["any", "all"]).optional(),
        ...PaginationInputSchema,
      },
      outputSchema: PastPapersOutputSchema,
      annotations: ToolAnnotations,
      _meta: {
        ...CatalogToolMeta,
        "openai/toolInvocation/invoking": "Searching ExamCooker past papers",
        "openai/toolInvocation/invoked": "Found ExamCooker past papers",
      },
    },
    async (input) => {
      const output = await listMcpPastPapers(input);
      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output) }],
      };
    },
  );

  registerAppTool(
    server,
    "list_syllabi",
    {
      title: "List ExamCooker Syllabi",
      description:
        "Browse public ExamCooker syllabi with typed pagination, parsed course metadata, stable syllabus ids, and canonical syllabus URLs.",
      inputSchema: {
        query: z.string().trim().max(240).optional(),
        ...PaginationInputSchema,
      },
      outputSchema: SyllabiOutputSchema,
      annotations: ToolAnnotations,
      _meta: {
        ...CatalogToolMeta,
        "openai/toolInvocation/invoking": "Listing ExamCooker syllabi",
        "openai/toolInvocation/invoked": "Listed ExamCooker syllabi",
      },
    },
    async (input) => {
      const output = await listMcpSyllabi(input);
      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output) }],
      };
    },
  );

  registerAppTool(
    server,
    "list_resources",
    {
      title: "Search ExamCooker Resources",
      description:
        "Search public module resources by keyword, course code, or catalog year.",
      inputSchema: {
        query: z.string().trim().max(240).optional(),
        courseCode: z.string().trim().max(40).optional(),
        year: z.string().trim().max(40).optional(),
        ...PaginationInputSchema,
      },
      outputSchema: ResourcesOutputSchema,
      annotations: ToolAnnotations,
      _meta: {
        ...CatalogToolMeta,
        "openai/toolInvocation/invoking": "Searching ExamCooker resources",
        "openai/toolInvocation/invoked": "Found ExamCooker resources",
      },
    },
    async (input) => {
      const output = await listMcpResources(input);
      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output) }],
      };
    },
  );

  registerAppTool(
    server,
    "get_course",
    {
      title: "Get ExamCooker Course",
      description:
        "Fetch public details for one ExamCooker course using a course:<code> id, course code, or canonical course URL, including canonical sibling links.",
      inputSchema: {
        id: z.string().trim().min(1).max(500),
      },
      outputSchema: FetchOutputSchema,
      annotations: ToolAnnotations,
      _meta: {
        ...CatalogToolMeta,
        "openai/toolInvocation/invoking": "Fetching ExamCooker course",
        "openai/toolInvocation/invoked": "Fetched ExamCooker course",
      },
    },
    async ({ id }) => {
      const ref = parseResourceRef(id);
      if (!ref || ref.kind !== "course") {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id,
                error:
                  "Expected a course:<code> id, a course code, or an ExamCooker course URL.",
              }),
            },
          ],
        };
      }

      const output = await fetchExamCookerResource(toResourceId(ref));
      if (!output) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id,
                error: "No public ExamCooker course was found for this id.",
              }),
            },
          ],
        };
      }

      return {
        structuredContent: output,
        content: fetchContent(output),
      };
    },
  );

  registerAppTool(
    server,
    "get_resource",
    {
      description:
        "Fetch public details for one module resource using a resource:<id> id or canonical ExamCooker resource URL.",
      inputSchema: {
        id: z.string().trim().min(1).max(500),
      },
      outputSchema: FetchOutputSchema,
      annotations: ToolAnnotations,
      _meta: {
        ...CatalogToolMeta,
        "openai/toolInvocation/invoking": "Fetching ExamCooker resource",
        "openai/toolInvocation/invoked": "Fetched ExamCooker resource",
      },
    },
    async ({ id }) => {
      const ref = parseResourceRef(id);
      if (!ref || (ref.kind !== "resource" && ref.kind !== "course")) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id,
                error:
                  "Expected a resource:<id> or course:<code> id, or an ExamCooker resource URL.",
              }),
            },
          ],
        };
      }

      const output = await fetchExamCookerResource(toResourceId(ref));
      if (!output) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id,
                error:
                  "No public ExamCooker resource or course was found for this id.",
              }),
            },
          ],
        };
      }
      return {
        structuredContent: output,
        content: fetchContent(output),
      };
    },
  );

  return server;
}
