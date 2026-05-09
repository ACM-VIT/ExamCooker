"use server";

import { createHmac, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/app/auth";
import {
  getCommandActionCapability,
  type CommandGeneratedAction,
  type CommandSurfaceContext,
} from "@/lib/command/actions";
import {
  resolveCommandIntent,
  type CommandIntent,
  type CommandResourceIntent,
} from "@/lib/command/intent";
import {
  getRecentPapers,
  getSearchableCourses,
} from "@/lib/data/course-catalog";
import { getPastPaperDetailPath } from "@/lib/seo";

const COMMAND_CLIENT_COOKIE = "ec-command-client-id";
const COMMAND_CLIENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const COMMAND_AGENT_RPC_TIMEOUT_MS = 6_500;
const COMMAND_AGENT_ADMIN_HEADER = "X-ExamCooker-Command-Admin";
const COMMAND_USER_TOKEN_TTL_MS = 10 * 60 * 1000;

type CommandCoursePreference = {
  courseCode: string;
  courseTitle: string | null;
  resource: CommandResourceIntent | null;
  weight: number;
  updatedAt: number;
};

type CommandIntentResponse = {
  intent: CommandIntent;
  courseQuery: string | null;
  actions: CommandGeneratedAction[];
  preferences: CommandCoursePreference[];
  resolver?: "openai" | "local" | "semantic-cache";
  source: "cloudflare-agent" | "local";
  transport?: "websocket" | "http" | "local";
};

type CommandRequestContext = {
  userKey: string;
  userToken: string | null;
  anonymousClientId: string | null;
  surfaceContext: Pick<CommandSurfaceContext, "authenticated" | "role">;
};

type CommandIntentActionInput = {
  query?: unknown;
  courseQuery?: unknown;
  preferenceQuery?: unknown;
  surfaceContext?: unknown;
};

type CommandPreferenceActionInput = {
  query?: unknown;
  courseCode?: unknown;
  courseTitle?: unknown;
  resource?: unknown;
};

function normalizeAgentHost(value: string | undefined) {
  return value?.replace(/^https?:\/\//, "").replace(/\/$/, "").trim() || "";
}

function getCommandAgentConnection() {
  const host = normalizeAgentHost(process.env.CLOUDFLARE_COMMAND_AGENT_HOST);
  if (!host) return null;

  const agent =
    process.env.CLOUDFLARE_COMMAND_AGENT_NAME || "ExamCookerCommandAgent";
  const name = process.env.CLOUDFLARE_COMMAND_AGENT_INSTANCE || "global";

  return { agent, host, name };
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function getCommandUserTokenSecret() {
  return process.env.CLOUDFLARE_COMMAND_AGENT_ADMIN_TOKEN?.trim() || "";
}

function signCommandUserToken(
  userKey: string,
  surfaceContext: Pick<CommandSurfaceContext, "authenticated" | "role">,
) {
  const secret = getCommandUserTokenSecret();
  if (!secret) return null;

  const payload = base64UrlEncode(
    JSON.stringify({
      userKey,
      authenticated: surfaceContext.authenticated === true,
      role: surfaceContext.role ?? null,
      exp: Date.now() + COMMAND_USER_TOKEN_TTL_MS,
    }),
  );
  const signature = createHmac("sha256", secret).update(payload).digest();

  return `v1.${payload}.${base64UrlEncode(signature)}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function callCommandAgent<T>(
  method: string,
  args: unknown[],
  timeoutMs = COMMAND_AGENT_RPC_TIMEOUT_MS,
) {
  const connection = getCommandAgentConnection();
  if (!connection) return null;

  const { AgentClient } = await import("agents/client");
  const client = new AgentClient(connection);

  try {
    await withTimeout(client.ready, timeoutMs, "Command agent WebSocket");
    return await client.call<T>(method, args, { timeout: timeoutMs });
  } finally {
    client.close(1000, "request complete");
  }
}

async function fetchCommandAgent(path: string | undefined, body: unknown) {
  const connection = getCommandAgentConnection();
  if (!connection) return null;

  const { agentFetch } = await import("agents/client");
  const normalizedPath = path?.replace(/^\/+/, "").trim();

  return agentFetch(
    {
      agent: connection.agent,
      name: connection.name,
      ...(normalizedPath ? { path: normalizedPath } : {}),
      host: connection.host,
    },
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

async function fetchCommandAgentAdmin(path: string | undefined) {
  const adminToken = process.env.CLOUDFLARE_COMMAND_AGENT_ADMIN_TOKEN?.trim();
  if (!adminToken) return null;

  const connection = getCommandAgentConnection();
  if (!connection) return null;

  const { agentFetch } = await import("agents/client");
  const normalizedPath = path?.replace(/^\/+/, "").trim();

  return agentFetch(
    {
      agent: connection.agent,
      name: connection.name,
      ...(normalizedPath ? { path: normalizedPath } : {}),
      host: connection.host,
    },
    {
      method: "GET",
      headers: {
        [COMMAND_AGENT_ADMIN_HEADER]: adminToken,
      },
    },
  );
}

async function getCommandRequestContext(): Promise<CommandRequestContext> {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id?.trim();

  if (userId) {
    const role = session?.user?.role;
    const userKey = `user:${userId}`;
    const surfaceContext = {
      authenticated: true,
      role: role === "MODERATOR" ? "moderator" : "user",
    } as const;

    return {
      userKey,
      userToken: signCommandUserToken(userKey, surfaceContext),
      anonymousClientId: null,
      surfaceContext,
    };
  }

  const cookieStore = await cookies();
  const currentClientId = cookieStore.get(COMMAND_CLIENT_COOKIE)?.value?.trim();
  const anonymousClientId = currentClientId || randomUUID();
  const surfaceContext = {
    authenticated: false,
    role: null,
  } as const;

  return {
    userKey: `anon:${anonymousClientId}`,
    userToken: signCommandUserToken(`anon:${anonymousClientId}`, surfaceContext),
    anonymousClientId: currentClientId ? null : anonymousClientId,
    surfaceContext,
  };
}

async function setCommandClientCookie(anonymousClientId: string | null) {
  if (!anonymousClientId) return;

  const cookieStore = await cookies();
  cookieStore.set(COMMAND_CLIENT_COOKIE, anonymousClientId, {
    httpOnly: true,
    maxAge: COMMAND_CLIENT_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function isModeratorSession(session: Awaited<ReturnType<typeof auth>>) {
  return session?.user?.role === "MODERATOR";
}

function isCommandIntent(value: unknown): value is CommandIntent {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CommandIntent>;
  return (
    (record.resource === null ||
      record.resource === "notes" ||
      record.resource === "syllabus" ||
      record.resource === "papers" ||
      record.resource === "course") &&
    (record.examType === null || typeof record.examType === "string") &&
    (record.confidence === "high" ||
      record.confidence === "medium" ||
      record.confidence === "low")
  );
}

function isCommandCoursePreference(
  value: unknown,
): value is CommandCoursePreference {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CommandCoursePreference>;
  return (
    typeof record.courseCode === "string" &&
    (record.courseTitle === null || typeof record.courseTitle === "string") &&
    (record.resource === null ||
      record.resource === "notes" ||
      record.resource === "syllabus" ||
      record.resource === "papers" ||
      record.resource === "course") &&
    typeof record.weight === "number" &&
    typeof record.updatedAt === "number"
  );
}

function isCommandGeneratedAction(value: unknown): value is CommandGeneratedAction {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CommandGeneratedAction>;
  return (
    typeof record.capabilityId === "string" &&
    getCommandActionCapability(record.capabilityId) !== null &&
    typeof record.title === "string" &&
    typeof record.meta === "string" &&
    typeof record.tone === "string" &&
    (record.confidence === "high" ||
      record.confidence === "medium" ||
      record.confidence === "low")
  );
}

function isCommandGeneratedActionForSurface(
  value: unknown,
  surfaceContext: CommandSurfaceContext,
): value is CommandGeneratedAction {
  return (
    isCommandGeneratedAction(value) &&
    getCommandActionCapability(value.capabilityId, surfaceContext) !== null
  );
}

function getRequestSurfaceContext(
  requestedContext: Partial<CommandSurfaceContext>,
  serverContext: Pick<CommandSurfaceContext, "authenticated" | "role">,
): Partial<CommandSurfaceContext> {
  return {
    currentPath: requestedContext.currentPath ?? null,
    voiceAgentEnabled: requestedContext.voiceAgentEnabled === true,
    authenticated: serverContext.authenticated,
    role: serverContext.role,
  };
}

function getConfidenceRank(intent: CommandIntent) {
  if (intent.confidence === "high") return 3;
  if (intent.confidence === "medium") return 2;
  return 1;
}

function shouldUseLocalIntent(
  localIntent: CommandIntent,
  cloudflareIntent: CommandIntent,
) {
  if (
    localIntent.resource &&
    localIntent.resource !== "course" &&
    cloudflareIntent.resource === "course"
  ) {
    return true;
  }

  return getConfidenceRank(localIntent) > getConfidenceRank(cloudflareIntent);
}

function readSurfaceContext(value: unknown): Partial<CommandSurfaceContext> {
  if (!value || typeof value !== "object") return {};
  const record = value as Partial<CommandSurfaceContext>;
  return {
    currentPath:
      typeof record.currentPath === "string" ? record.currentPath : null,
    authenticated:
      typeof record.authenticated === "boolean" ? record.authenticated : null,
    role:
      record.role === "moderator" || record.role === "user" ? record.role : null,
    voiceAgentEnabled:
      typeof record.voiceAgentEnabled === "boolean"
        ? record.voiceAgentEnabled
        : null,
  };
}

function isCommandResource(value: unknown) {
  return (
    value === "course" ||
    value === "notes" ||
    value === "syllabus" ||
    value === "papers"
  );
}

async function readResponseJson(response: Response) {
  return (await response.json().catch(() => null)) as unknown;
}

async function resolveWithCloudflareAgent(input: {
  query: string;
  preferenceQuery: string;
  userKey: string;
  userToken: string | null;
  surfaceContext: Partial<CommandSurfaceContext>;
}) {
  type AgentPayload = {
    intent?: unknown;
    courseQuery?: unknown;
    actions?: unknown;
    preferences?: unknown;
    resolver?: unknown;
  };

  type AgentResult = {
    intent: CommandIntent;
    courseQuery: string;
    actions: CommandGeneratedAction[];
    preferences: CommandCoursePreference[];
    resolver?: "openai" | "local" | "semantic-cache";
    transport: "websocket" | "http";
  };

  const normalizePayload = (
    payload: AgentPayload | null,
    transport: "websocket" | "http",
  ): AgentResult | null => {
    if (!isCommandIntent(payload?.intent)) return null;
    const capabilityContext: CommandSurfaceContext = {
      query: input.query,
      currentPath: input.surfaceContext.currentPath ?? null,
      authenticated: input.surfaceContext.authenticated ?? null,
      role: input.surfaceContext.role ?? null,
      voiceAgentEnabled: input.surfaceContext.voiceAgentEnabled ?? null,
    };
    const resolver: AgentResult["resolver"] =
      payload.resolver === "openai" ||
      payload.resolver === "local" ||
      payload.resolver === "semantic-cache"
        ? payload.resolver
        : undefined;

    return {
      intent: payload.intent,
      courseQuery:
        typeof payload.courseQuery === "string" ? payload.courseQuery : "",
      actions: Array.isArray(payload.actions)
        ? payload.actions.filter((action) =>
            isCommandGeneratedActionForSurface(action, capabilityContext),
          )
        : [],
      preferences: Array.isArray(payload.preferences)
        ? payload.preferences.filter(isCommandCoursePreference)
        : [],
      resolver,
      transport,
    };
  };

  try {
    const payload = await callCommandAgent<AgentPayload>("resolveIntent", [input]);
    const result = normalizePayload(payload, "websocket");
    if (result) return result;
  } catch (error) {
    console.warn("[command] Cloudflare command agent WebSocket unavailable", error);
  }

  const path = process.env.CLOUDFLARE_COMMAND_AGENT_PATH?.trim();
  const response = await fetchCommandAgent(path, input);
  if (!response?.ok) return null;

  return normalizePayload((await readResponseJson(response)) as AgentPayload, "http");
}

export async function getCommandCatalogAction() {
  const [courses, recentPapers] = await Promise.all([
    getSearchableCourses(),
    getRecentPapers(12),
  ]);

  return {
    courses: courses.map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
      aliases: course.aliases,
      paperCount: course.paperCount,
      noteCount: course.noteCount,
      syllabusId: course.syllabusId,
    })),
    recentPapers: recentPapers.map((paper) => ({
      id: paper.id,
      title: paper.title,
      courseCode: paper.courseCode,
      courseTitle: paper.courseTitle,
      examType: paper.examType,
      slot: paper.slot,
      year: paper.year,
      href: getPastPaperDetailPath(paper.id, paper.courseCode),
    })),
  };
}

export async function getCommandSessionAction() {
  const { userKey, userToken, anonymousClientId, surfaceContext } =
    await getCommandRequestContext();
  await setCommandClientCookie(anonymousClientId);

  return {
    userKey,
    userToken,
    surfaceContext,
  };
}

export async function resolveCommandIntentAction(
  input: CommandIntentActionInput,
): Promise<CommandIntentResponse> {
  const query = typeof input.query === "string" ? input.query : "";
  const preferenceQuery =
    typeof input.preferenceQuery === "string"
      ? input.preferenceQuery
      : typeof input.courseQuery === "string"
        ? input.courseQuery
        : query;
  const surfaceContext = readSurfaceContext(input.surfaceContext);
  const localIntent = resolveCommandIntent(query);
  const requestContext = await getCommandRequestContext();
  const { userKey, userToken, anonymousClientId } = requestContext;
  const trustedSurfaceContext = getRequestSurfaceContext(
    surfaceContext,
    requestContext.surfaceContext,
  );

  try {
    const cloudflareResult = await resolveWithCloudflareAgent({
      query,
      preferenceQuery,
      userKey,
      userToken,
      surfaceContext: trustedSurfaceContext,
    });

    if (cloudflareResult) {
      await setCommandClientCookie(anonymousClientId);

      if (shouldUseLocalIntent(localIntent, cloudflareResult.intent)) {
        return {
          intent: localIntent,
          courseQuery: cloudflareResult.courseQuery || null,
          actions: cloudflareResult.actions,
          preferences: cloudflareResult.preferences,
          resolver: cloudflareResult.resolver,
          source: "local",
          transport: cloudflareResult.transport,
        };
      }

      return {
        intent: cloudflareResult.intent,
        courseQuery: cloudflareResult.courseQuery || null,
        actions: cloudflareResult.actions,
        preferences: cloudflareResult.preferences,
        resolver: cloudflareResult.resolver,
        source: "cloudflare-agent",
        transport: cloudflareResult.transport,
      };
    }
  } catch (error) {
    console.warn("[command] Cloudflare command agent unavailable", error);
  }

  await setCommandClientCookie(anonymousClientId);

  return {
    intent: localIntent,
    courseQuery: null,
    actions: [],
    preferences: [],
    source: "local",
    transport: "local",
  };
}

export async function rememberCommandPreferenceAction(
  input: CommandPreferenceActionInput,
) {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  const courseCode =
    typeof input.courseCode === "string"
      ? input.courseCode.trim().toUpperCase()
      : "";

  if (!query || !courseCode) {
    return { ok: false, source: "local", error: "Missing query or courseCode." };
  }

  const { userKey, userToken, anonymousClientId } =
    await getCommandRequestContext();
  const agentPayload = {
    userKey,
    userToken,
    query,
    courseCode,
    courseTitle: typeof input.courseTitle === "string" ? input.courseTitle : null,
    resource: isCommandResource(input.resource) ? input.resource : null,
  };

  try {
    const rpcResult = await callCommandAgent<{ preference?: unknown }>(
      "recordPreference",
      [agentPayload],
    );

    if (rpcResult?.preference) {
      await setCommandClientCookie(anonymousClientId);
      return {
        ok: true,
        source: "cloudflare-agent",
        transport: "websocket",
      };
    }
  } catch (error) {
    console.warn("[command] Cloudflare command preference WebSocket unavailable", error);
  }

  try {
    const response = await fetchCommandAgent("/preference", agentPayload);

    if (response?.ok) {
      await setCommandClientCookie(anonymousClientId);
      return {
        ok: true,
        source: "cloudflare-agent",
        transport: "http",
      };
    }
  } catch (error) {
    console.warn("[command] Cloudflare command preference unavailable", error);
  }

  await setCommandClientCookie(anonymousClientId);
  return { ok: false, source: "local" };
}

export async function getCommandHistoryAction(input?: { limit?: number }) {
  const session = await auth().catch(() => null);
  if (!isModeratorSession(session)) return { ok: false, error: "Not found" };

  const limit =
    typeof input?.limit === "number" && Number.isFinite(input.limit)
      ? Math.max(1, Math.min(100, Math.trunc(input.limit)))
      : null;
  const path = limit ? `/history?limit=${encodeURIComponent(limit)}` : "/history";
  const response = await fetchCommandAgentAdmin(path);

  if (!response) {
    return {
      ok: false,
      error: "Command agent admin route is not configured.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: await readResponseJson(response),
    };
  }

  return {
    ok: true,
    status: response.status,
    data: await readResponseJson(response),
  };
}

export async function getCommandStatsAction() {
  const session = await auth().catch(() => null);
  if (!isModeratorSession(session)) return { ok: false, error: "Not found" };

  const response = await fetchCommandAgentAdmin("/stats");

  if (!response) {
    return {
      ok: false,
      error: "Command agent admin route is not configured.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: await readResponseJson(response),
    };
  }

  return {
    ok: true,
    status: response.status,
    data: await readResponseJson(response),
  };
}
