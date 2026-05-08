import type { CommandIntent } from "../../lib/command/intent";
import type {
  CommandGeneratedAction,
  CommandSurfaceContext,
} from "../../lib/command/actions";

export type CommandResolver = "openai" | "local" | "semantic-cache";

export type Env = {
  ExamCookerCommandAgent: DurableObjectNamespace;
  CLOUDFLARE_COMMAND_AGENT_ADMIN_TOKEN?: string;
  OPENAI_API_KEY?: string;
  OPENAI_COMMAND_MODEL?: string;
  OPENAI_EMBEDDING_MODEL?: string;
};

export type CommandAgentState = {
  requests: number;
  lastQuery: string | null;
  lastIntent: CommandIntent | null;
  lastCourseQuery: string | null;
  lastResolver: CommandResolver | null;
  updatedAt: string | null;
};

export type CommandIntentCacheValue = {
  intent: CommandIntent;
  courseQuery: string;
  actions: CommandGeneratedAction[];
  resolver: "openai" | "local";
};

export type CommandHistoryEvent = {
  id: string;
  query: string;
  resource: CommandIntent["resource"];
  examType: CommandIntent["examType"];
  confidence: CommandIntent["confidence"];
  createdAt: number;
};

export type CommandHistoryRow = {
  id: string;
  query: string;
  resource: CommandIntent["resource"];
  examType: CommandIntent["examType"];
  confidence: CommandIntent["confidence"];
  createdAt: number;
};

export type CommandStats = {
  total: number;
  byResource: Array<{
    resource: string;
    count: number;
  }>;
  byExamType: Array<{
    examType: string;
    count: number;
  }>;
};

export type CommandCoursePreferenceInput = {
  userKey: string;
  query: string;
  courseCode: string;
  courseTitle?: string | null;
  resource?: CommandIntent["resource"];
  selectedAt: number;
};

export type CommandCoursePreference = {
  courseCode: string;
  courseTitle: string | null;
  resource: CommandIntent["resource"];
  weight: number;
  updatedAt: number;
};

export type CommandIntentRequestInput = {
  query?: string;
  preferenceQuery?: string;
  userKey?: string;
  userToken?: string | null;
  surfaceContext?: Partial<CommandSurfaceContext>;
};

export type CommandPreferenceRequestInput = {
  userKey?: string;
  userToken?: string | null;
  query?: string;
  courseCode?: string;
  courseTitle?: string | null;
  resource?: CommandIntent["resource"];
};
