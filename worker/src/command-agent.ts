import { Agent, callable } from "agents";
import {
  ensureCommandHistorySchema,
  listCommandCoursePreferences,
  getCommandStats,
  listCommandHistory,
  pruneCommandHistory,
  recordCommandCoursePreference,
  recordCommandEvent,
} from "./command-history";
import {
  emptyResponse,
  jsonResponse,
  readCommandIntentInput,
  readJsonPayload,
  readLimit,
} from "./http";
import { resolveCommandIntentWithAI } from "./intent-ai";
import {
  ensureCommandSemanticCacheSchema,
  findCommandSemanticCacheHit,
  pruneCommandSemanticCache,
  storeCommandSemanticCache,
} from "./semantic-cache";
import type { CommandSurfaceContext } from "../../lib/command/actions";
import type {
  CommandAgentState,
  CommandIntentRequestInput,
  CommandPreferenceRequestInput,
  Env,
} from "./types";

const COMMAND_AGENT_ADMIN_HEADER = "X-ExamCooker-Command-Admin";

function getAgentAction(request: Request) {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return segments[3] ?? "intent";
}

function resolveSurfaceContext(
  query: string,
  surfaceContext: CommandIntentRequestInput["surfaceContext"],
): CommandSurfaceContext {
  return {
    query,
    currentPath:
      typeof surfaceContext?.currentPath === "string"
        ? surfaceContext.currentPath
        : null,
    authenticated:
      typeof surfaceContext?.authenticated === "boolean"
        ? surfaceContext.authenticated
        : null,
    role:
      surfaceContext?.role === "moderator" || surfaceContext?.role === "user"
        ? surfaceContext.role
        : null,
    voiceAgentEnabled:
      typeof surfaceContext?.voiceAgentEnabled === "boolean"
        ? surfaceContext.voiceAgentEnabled
        : null,
  };
}

export class ExamCookerCommandAgent extends Agent<Env, CommandAgentState> {
  initialState: CommandAgentState = {
    requests: 0,
    lastQuery: null,
    lastIntent: null,
    lastCourseQuery: null,
    lastResolver: null,
    updatedAt: null,
  };

  async onStart() {
    ensureCommandHistorySchema(this);
    ensureCommandSemanticCacheSchema(this);
    await this.scheduleEvery(86_400, "pruneHistory", undefined, {
      _idempotent: true,
    });
  }

  async onRequest(request: Request) {
    if (request.method === "OPTIONS") {
      return emptyResponse({ status: 204 });
    }

    const action = getAgentAction(request);

    if (action === "history") {
      return this.handleHistory(request);
    }

    if (action === "stats") {
      return this.handleStats(request);
    }

    if (action === "preference") {
      return this.handlePreference(request);
    }

    if (action === "intent") {
      return this.handleIntent(request);
    }

    return jsonResponse({ error: "Unknown command agent action." }, { status: 404 });
  }

  async pruneHistory() {
    ensureCommandHistorySchema(this);
    ensureCommandSemanticCacheSchema(this);
    pruneCommandHistory(this);
    pruneCommandSemanticCache(this);
  }

  @callable()
  async resolveIntent(input: CommandIntentRequestInput) {
    ensureCommandHistorySchema(this);
    ensureCommandSemanticCacheSchema(this);

    const query = typeof input.query === "string" ? input.query : "";
    const preferenceQuery =
      typeof input.preferenceQuery === "string" ? input.preferenceQuery : "";
    const userKey = typeof input.userKey === "string" ? input.userKey : "";
    const surfaceContext = resolveSurfaceContext(query, input.surfaceContext);
    const semanticCacheHit = await findCommandSemanticCacheHit(this, this.env, {
      query,
      surfaceContext,
    }).catch(() => null);
    const resolution = semanticCacheHit
      ? {
          ...semanticCacheHit.value,
          resolver: "semantic-cache" as const,
        }
      : await resolveCommandIntentWithAI(this.env, query, {
          surfaceContext,
        });

    if (!semanticCacheHit && resolution.resolver === "openai") {
      await storeCommandSemanticCache(this, this.env, {
        query,
        surfaceContext,
        value: {
          intent: resolution.intent,
          courseQuery: resolution.courseQuery,
          actions: resolution.actions,
          resolver: "openai",
        },
      }).catch(() => undefined);
    }

    const timestamp = Date.now();
    const preferenceLookupQuery =
      resolution.courseQuery || preferenceQuery || query;
    const preferences = listCommandCoursePreferences(
      this,
      userKey,
      preferenceLookupQuery,
    );

    recordCommandEvent(this, {
      id: crypto.randomUUID(),
      query,
      userKey,
      resource: resolution.intent.resource,
      examType: resolution.intent.examType,
      confidence: resolution.intent.confidence,
      createdAt: timestamp,
    });

    const nextState = {
      requests: this.state.requests + 1,
      lastQuery: query,
      lastIntent: resolution.intent,
      lastCourseQuery: resolution.courseQuery || null,
      lastResolver: resolution.resolver,
      updatedAt: new Date(timestamp).toISOString(),
    };

    this.setState(nextState);

    return {
      intent: resolution.intent,
      courseQuery: resolution.courseQuery,
      actions: resolution.actions,
      preferences,
      resolver: resolution.resolver,
      cache: semanticCacheHit
        ? {
            status: "hit",
            similarity: semanticCacheHit.similarity,
            query: semanticCacheHit.query,
          }
        : {
            status: "miss",
          },
      state: {
        requests: nextState.requests,
        updatedAt: nextState.updatedAt,
      },
      source: "cloudflare-agent",
    };
  }

  @callable()
  async recordPreference(input: CommandPreferenceRequestInput) {
    ensureCommandHistorySchema(this);

    const result = recordCommandCoursePreference(this, {
      userKey: typeof input.userKey === "string" ? input.userKey : "",
      query: typeof input.query === "string" ? input.query : "",
      courseCode: typeof input.courseCode === "string" ? input.courseCode : "",
      courseTitle:
        typeof input.courseTitle === "string" ? input.courseTitle : null,
      resource:
        input.resource === "notes" ||
        input.resource === "syllabus" ||
        input.resource === "papers" ||
        input.resource === "course"
          ? input.resource
          : null,
      selectedAt: Date.now(),
    });

    return {
      preference: result,
      source: "cloudflare-agent",
    };
  }

  private async handleIntent(request: Request) {
    if (request.method !== "GET" && request.method !== "POST") {
      return jsonResponse(
        { error: "Use GET ?query=... or POST with { query }." },
        { status: 405 },
      );
    }

    return jsonResponse(await this.resolveIntent(await readCommandIntentInput(request)));
  }

  private async handlePreference(request: Request) {
    if (request.method !== "POST") {
      return jsonResponse(
        { error: "Use POST with { userKey, query, courseCode }." },
        { status: 405 },
      );
    }

    const payload = await readJsonPayload(request);
    const { preference } = await this.recordPreference({
      userKey: typeof payload?.userKey === "string" ? payload.userKey : "",
      query: typeof payload?.query === "string" ? payload.query : "",
      courseCode:
        typeof payload?.courseCode === "string" ? payload.courseCode : "",
      courseTitle:
        typeof payload?.courseTitle === "string" ? payload.courseTitle : null,
      resource:
        payload?.resource === "notes" ||
        payload?.resource === "syllabus" ||
        payload?.resource === "papers" ||
        payload?.resource === "course"
          ? payload.resource
          : null,
    });

    if (!preference) {
      return jsonResponse(
        { error: "Missing userKey, query, or courseCode." },
        { status: 400 },
      );
    }

    return jsonResponse({
      preference,
      source: "cloudflare-agent",
    });
  }

  private handleHistory(request: Request) {
    if (request.method !== "GET") {
      return jsonResponse({ error: "Use GET for command history." }, { status: 405 });
    }

    if (!this.isModeratorDebugRequest(request)) {
      return jsonResponse({ error: "Not found" }, { status: 404 });
    }

    ensureCommandHistorySchema(this);

    return jsonResponse({
      events: listCommandHistory(this, readLimit(request, 10, 50)),
      source: "cloudflare-agent",
    });
  }

  private handleStats(request: Request) {
    if (!this.isModeratorDebugRequest(request)) {
      return jsonResponse({ error: "Not found" }, { status: 404 });
    }

    ensureCommandHistorySchema(this);

    return jsonResponse({
      stats: getCommandStats(this),
      state: this.state,
      source: "cloudflare-agent",
    });
  }

  private isModeratorDebugRequest(request: Request) {
    const expectedToken = this.env.CLOUDFLARE_COMMAND_AGENT_ADMIN_TOKEN?.trim();
    const receivedToken = request.headers.get(COMMAND_AGENT_ADMIN_HEADER)?.trim();

    return Boolean(expectedToken && receivedToken && receivedToken === expectedToken);
  }
}
