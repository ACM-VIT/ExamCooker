import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output, stepCountIs } from "ai";
import { z } from "zod";
import {
  getCommandActionCapability,
  getCommandSurface,
  type CommandActionCapability,
  type CommandGeneratedAction,
  type CommandSurfaceContext,
} from "../../lib/command/actions";
import {
  normalizeCommandSearch,
  resolveCommandIntent,
  type CommandIntent,
  type CommandResourceIntent,
} from "../../lib/command/intent";
import { createCommandSurfaceTool } from "./command-surface-tool";
import type { CommandResolver, Env } from "./types";

const COMMAND_RESOURCES = [
  "notes",
  "syllabus",
  "papers",
  "course",
] as const satisfies readonly CommandResourceIntent[];

const COMMAND_EXAM_TYPES = [
  "MODEL_CAT_1",
  "MODEL_CAT_2",
  "MODEL_FAT",
  "CAT_1",
  "CAT_2",
  "FAT",
  "MID",
  "QUIZ",
  "CIA",
] as const satisfies readonly NonNullable<CommandIntent["examType"]>[];

const COMMAND_CONFIDENCE = ["high", "medium", "low"] as const;

const commandIntentSchema = z.object({
  resource: z.enum(COMMAND_RESOURCES).nullable(),
  examType: z.enum(COMMAND_EXAM_TYPES).nullable(),
  confidence: z.enum(COMMAND_CONFIDENCE),
  courseQuery: z.string(),
  actions: z.array(
    z.object({
      capabilityId: z.string(),
      title: z.string(),
      meta: z.string(),
      tone: z.string(),
      confidence: z.enum(COMMAND_CONFIDENCE),
    }),
  ),
});

export type CommandIntentResolution = {
  intent: CommandIntent;
  courseQuery: string;
  actions: CommandGeneratedAction[];
  resolver: CommandResolver;
};

type ResolveCommandIntentOptions = {
  surfaceContext?: Partial<CommandSurfaceContext>;
};

function getLocalResolution(query: string): CommandIntentResolution {
  return {
    intent: resolveCommandIntent(query),
    courseQuery: "",
    actions: [],
    resolver: "local",
  };
}

function coerceIntent(
  query: string,
  object: z.infer<typeof commandIntentSchema>,
): CommandIntent {
  const fallback = resolveCommandIntent(query);
  let resource = object.resource ?? fallback.resource;
  const examType = object.examType ?? fallback.examType;

  if (examType && (!resource || resource === "course")) {
    resource = "papers";
  }

  return {
    resource,
    examType: resource === "papers" ? examType : null,
    confidence: object.confidence,
  };
}

function normalizeActions(
  actions: z.infer<typeof commandIntentSchema>["actions"],
  capabilities: readonly CommandActionCapability[],
): CommandGeneratedAction[] {
  const allowedIds = new Set(capabilities.map((capability) => capability.id));
  const seen = new Set<string>();

  return actions
    .filter((action) => allowedIds.has(action.capabilityId))
    .filter((action) => {
      if (seen.has(action.capabilityId)) return false;
      seen.add(action.capabilityId);
      return true;
    })
    .slice(0, 3)
    .map((action) => {
      const capability = getCommandActionCapability(action.capabilityId);
      const title = action.title.trim() || capability?.title || "Open action";
      const meta = action.meta.trim() || capability?.description || "Command action";
      const tone = action.tone.trim() || capability?.tone || "Action";

      return {
        capabilityId: action.capabilityId,
        title: title.slice(0, 80),
        meta: meta.slice(0, 96),
        tone: tone.slice(0, 24),
        confidence: action.confidence,
      };
    });
}

export async function resolveCommandIntentWithAI(
  env: Env,
  query: string,
  options: ResolveCommandIntentOptions = {},
): Promise<CommandIntentResolution> {
  const trimmedQuery = query.trim();
  const apiKey = env.OPENAI_API_KEY?.trim();
  const surfaceContext: CommandSurfaceContext = {
    query: trimmedQuery,
    currentPath: options.surfaceContext?.currentPath ?? null,
    authenticated: options.surfaceContext?.authenticated ?? null,
    role: options.surfaceContext?.role ?? null,
  };
  const commandSurface = getCommandSurface(surfaceContext);
  const actionCapabilities = commandSurface.capabilities;

  if (!trimmedQuery || !apiKey) {
    return getLocalResolution(query);
  }

  try {
    const openai = createOpenAI({ apiKey });
    const model = env.OPENAI_COMMAND_MODEL?.trim() || "gpt-5.4-nano";
    const { output: object } = await generateText({
      model: openai(model),
      output: Output.object({
        schema: commandIntentSchema,
        name: "command_palette_resolution",
        description:
          "Resolved command palette intent and executable actions selected from the command surface tool.",
      }),
      tools: {
        getCommandSurface: createCommandSurfaceTool(surfaceContext),
      },
      stopWhen: stepCountIs(2),
      prepareStep: ({ stepNumber }) =>
        stepNumber === 0
          ? {
              toolChoice: {
                type: "tool",
                toolName: "getCommandSurface",
              },
            }
          : {
              toolChoice: "none",
            },
      maxOutputTokens: 260,
      maxRetries: 0,
      providerOptions: {
        openai: {
          reasoningEffort: "low",
          store: false,
          textVerbosity: "low",
        },
      },
      system:
        "Classify an ExamCooker command palette query. Return only fields matching the schema. " +
        "resource is the user's target: notes, syllabus, papers, or course. " +
        "Use papers when the query asks for previous papers, pyqs, exams, CAT/FAT/MID/QUIZ/CIA, or a model paper. " +
        "courseQuery must be only the corrected course name/code/abbreviation, with resource words, exam words, and filler removed. " +
        "Fix obvious typos and expand obvious course shorthand when confident, but never invent course codes. " +
        "If the user only names a resource, leave courseQuery empty. " +
        "Before answering, call getCommandSurface to inspect pages, route templates, and executable capabilities available to this user. " +
        "For app-level requests, create actions only by choosing capability ids returned by getCommandSurface. " +
        "Do not create actions for course/resource searches unless the query directly asks for one of the returned capabilities.",
      prompt: JSON.stringify({
        query: trimmedQuery,
        currentPath: surfaceContext.currentPath,
        authenticated: surfaceContext.authenticated,
        role: surfaceContext.role,
        examples: [
          {
            input: "control sys sysllabus",
            output: {
              resource: "syllabus",
              examType: null,
              confidence: "high",
              courseQuery: "control systems",
              actions: [],
            },
          },
          {
            input: "cat 1 dsa",
            output: {
              resource: "papers",
              examType: "CAT_1",
              confidence: "high",
              courseQuery: "dsa",
              actions: [],
            },
          },
          {
            input: "notes for control systems",
            output: {
              resource: "notes",
              examType: null,
              confidence: "high",
              courseQuery: "control systems",
              actions: [],
            },
          },
          {
            input: "sylla",
            output: {
              resource: "syllabus",
              examType: null,
              confidence: "medium",
              courseQuery: "",
              actions: [],
            },
          },
        ],
      }),
    });

    const actions = normalizeActions(object.actions, actionCapabilities);
    const courseQuery = normalizeCommandSearch(object.courseQuery).slice(0, 96);
    const intent =
      actions.some((action) => action.confidence !== "low") && !courseQuery
        ? {
            resource: null,
            examType: null,
            confidence: object.confidence,
          }
        : coerceIntent(trimmedQuery, object);

    return {
      intent,
      courseQuery,
      actions,
      resolver: "openai",
    };
  } catch (error) {
    console.warn("[command-agent] OpenAI intent resolver failed", error);
    return getLocalResolution(query);
  }
}
