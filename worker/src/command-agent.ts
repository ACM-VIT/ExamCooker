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
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

async function sha256Bytes(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", textEncoder.encode(value)),
  );
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;

  let difference = 0;
  for (let index = 0; index < left.byteLength; index++) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
}

async function timingSafeTokenMatch(receivedToken: string, expectedToken: string) {
  const [receivedHash, expectedHash] = await Promise.all([
    sha256Bytes(receivedToken),
    sha256Bytes(expectedToken),
  ]);

  return timingSafeEqual(receivedHash, expectedHash);
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function hmacSha256Bytes(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, textEncoder.encode(value)),
  );
}

async function isCommandUserTokenValid(input: {
  userKey: string;
  userToken: string;
  secret: string;
}) {
  const [version, payloadPart, signaturePart] = input.userToken.split(".");
  if (version !== "v1" || !payloadPart || !signaturePart) return false;

  let receivedSignature: Uint8Array;
  let payload: { userKey?: unknown; exp?: unknown };

  try {
    receivedSignature = base64UrlToBytes(signaturePart);
    payload = JSON.parse(textDecoder.decode(base64UrlToBytes(payloadPart))) as {
      userKey?: unknown;
      exp?: unknown;
    };
  } catch {
    return false;
  }

  const expectedSignature = await hmacSha256Bytes(input.secret, payloadPart);
  if (!timingSafeEqual(receivedSignature, expectedSignature)) return false;

  return (
    payload.userKey === input.userKey &&
    typeof payload.exp === "number" &&
    payload.exp >= Date.now()
  );
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

  private async getTrustedUserKey(input: {
    userKey?: unknown;
    userToken?: unknown;
  }) {
    const userKey = typeof input.userKey === "string" ? input.userKey.trim() : "";
    const userToken =
      typeof input.userToken === "string" ? input.userToken.trim() : "";
    const secret = this.env.CLOUDFLARE_COMMAND_AGENT_ADMIN_TOKEN?.trim();

    if (!userKey || !userToken || !secret) return "";

    return (await isCommandUserTokenValid({ userKey, userToken, secret }))
      ? userKey
      : "";
  }

  @callable()
  async resolveIntent(input: CommandIntentRequestInput) {
    ensureCommandHistorySchema(this);
    ensureCommandSemanticCacheSchema(this);

    const query = typeof input.query === "string" ? input.query : "";
    const preferenceQuery =
      typeof input.preferenceQuery === "string" ? input.preferenceQuery : "";
    const userKey = await this.getTrustedUserKey(input);
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
      userKey: await this.getTrustedUserKey(input),
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
      userToken:
        typeof payload?.userToken === "string" ? payload.userToken : "",
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

  private async handleHistory(request: Request) {
    if (request.method !== "GET") {
      return jsonResponse({ error: "Use GET for command history." }, { status: 405 });
    }

    if (!(await this.isModeratorDebugRequest(request))) {
      return jsonResponse({ error: "Not found" }, { status: 404 });
    }

    ensureCommandHistorySchema(this);

    return jsonResponse({
      events: listCommandHistory(this, readLimit(request, 10, 50)),
      source: "cloudflare-agent",
    });
  }

  private async handleStats(request: Request) {
    if (!(await this.isModeratorDebugRequest(request))) {
      return jsonResponse({ error: "Not found" }, { status: 404 });
    }

    ensureCommandHistorySchema(this);

    return jsonResponse({
      stats: getCommandStats(this),
      state: this.state,
      source: "cloudflare-agent",
    });
  }

  private async isModeratorDebugRequest(request: Request) {
    const expectedToken = this.env.CLOUDFLARE_COMMAND_AGENT_ADMIN_TOKEN?.trim();
    const receivedToken = request.headers.get(COMMAND_AGENT_ADMIN_HEADER)?.trim();

    if (!expectedToken || !receivedToken) return false;
    return timingSafeTokenMatch(receivedToken, expectedToken);
  }
}
