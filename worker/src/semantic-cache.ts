import type { Agent } from "agents";
import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
import { getCommandSurface, type CommandSurfaceContext } from "../../lib/command/actions";
import { normalizeCommandSearch } from "../../lib/command/intent";
import type {
  CommandAgentState,
  CommandIntentCacheValue,
  Env,
} from "./types";

type CommandAgent = Agent<Env, CommandAgentState>;

type CommandCacheRow = {
  id: string;
  query: string;
  queryKey: string;
  embedding: string | null;
  value: string;
  hitCount: number;
  updatedAt: number;
};

export type CommandSemanticCacheHit = {
  value: CommandIntentCacheValue;
  similarity: number;
  query: string;
};

const SEMANTIC_CACHE_LIMIT = 96;
const SEMANTIC_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SEMANTIC_CACHE_INTENT_MATCH_THRESHOLD = 0.925;
const SEMANTIC_CACHE_ACTION_MATCH_THRESHOLD = 0.54;
const SEMANTIC_CACHE_EMBEDDING_CANDIDATES = 80;
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const CAPABILITY_MATCH_STOP_TERMS = new Set([
  "a",
  "an",
  "and",
  "for",
  "get",
  "go",
  "launch",
  "me",
  "my",
  "open",
  "please",
  "show",
  "start",
  "the",
  "to",
]);

function getSurfaceCacheKey(surfaceContext: CommandSurfaceContext) {
  const surface = getCommandSurface(surfaceContext);
  return surface.capabilities
    .map((capability) => capability.id)
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
    .join("|");
}

function parseEmbedding(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    const embedding = parsed.filter((entry): entry is number => typeof entry === "number");
    return embedding.length > 0 ? embedding : null;
  } catch {
    return null;
  }
}

function parseCacheValue(value: string): CommandIntentCacheValue | null {
  try {
    const parsed = JSON.parse(value) as Partial<CommandIntentCacheValue>;
    if (!parsed.intent || typeof parsed.intent !== "object") return null;
    if (!Array.isArray(parsed.actions)) return null;

    return {
      intent: parsed.intent as CommandIntentCacheValue["intent"],
      courseQuery: typeof parsed.courseQuery === "string" ? parsed.courseQuery : "",
      actions: parsed.actions,
      resolver: parsed.resolver === "local" ? "local" : "openai",
    };
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    dot += left * right;
    normA += left * left;
    normB += right * right;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getCapabilityCandidates(
  query: string,
  surfaceContext: CommandSurfaceContext,
) {
  const normalizedQuery = normalizeCommandSearch(query);
  if (!normalizedQuery) return new Set<string>();

  const terms = normalizedQuery
    .split(" ")
    .filter((term) => term.length > 2 && !CAPABILITY_MATCH_STOP_TERMS.has(term));
  const surface = getCommandSurface(surfaceContext);
  const candidates = new Set<string>();

  for (const capability of surface.capabilities) {
    const normalizedKeywords = capability.keywords
      .map((keyword) => normalizeCommandSearch(keyword))
      .filter(Boolean);
    const exactKeywordMatch = normalizedKeywords.some((keyword) =>
      normalizedQuery.includes(keyword),
    );

    if (exactKeywordMatch) {
      candidates.add(capability.id);
      continue;
    }

    const haystack = normalizeCommandSearch(
      [capability.title, capability.description, ...capability.keywords].join(" "),
    );
    if (terms.some((term) => haystack.includes(term))) {
      candidates.add(capability.id);
    }
  }

  return candidates;
}

function isSemanticCacheHitAllowed(
  value: CommandIntentCacheValue,
  query: string,
  surfaceContext: CommandSurfaceContext,
  similarity: number,
) {
  const actionIds = value.actions.map((action) => action.capabilityId);

  if (actionIds.length === 0) {
    return similarity >= SEMANTIC_CACHE_INTENT_MATCH_THRESHOLD;
  }

  if (similarity < SEMANTIC_CACHE_ACTION_MATCH_THRESHOLD) {
    return false;
  }

  const candidates = getCapabilityCandidates(query, surfaceContext);
  return actionIds.every((actionId) => candidates.has(actionId));
}

async function embedCommandQuery(env: Env, query: string) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey || !query.trim()) return null;

  const openai = createOpenAI({ apiKey });
  const model = env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
  const { embedding } = await embed({
    model: openai.embedding(model),
    value: query,
    maxRetries: 0,
  });

  return {
    embedding,
    model,
  };
}

export function ensureCommandSemanticCacheSchema(agent: CommandAgent) {
  agent.sql`
    CREATE TABLE IF NOT EXISTS command_semantic_cache (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      query_key TEXT NOT NULL,
      context_key TEXT NOT NULL,
      embedding_model TEXT NOT NULL,
      embedding_json TEXT,
      value_json TEXT NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `;

  agent.sql`
    CREATE UNIQUE INDEX IF NOT EXISTS command_semantic_cache_exact_idx
    ON command_semantic_cache (query_key, context_key)
  `;

  agent.sql`
    CREATE INDEX IF NOT EXISTS command_semantic_cache_lookup_idx
    ON command_semantic_cache (context_key, embedding_model, updated_at DESC)
  `;
}

export async function findCommandSemanticCacheHit(
  agent: CommandAgent,
  env: Env,
  input: {
    query: string;
    surfaceContext: CommandSurfaceContext;
  },
): Promise<CommandSemanticCacheHit | null> {
  const queryKey = normalizeCommandSearch(input.query);
  if (!queryKey) return null;

  const now = Date.now();
  const contextKey = getSurfaceCacheKey(input.surfaceContext);
  const exactRows = agent.sql<CommandCacheRow>`
    SELECT
      id,
      query,
      query_key AS queryKey,
      embedding_json AS embedding,
      value_json AS value,
      hit_count AS hitCount,
      updated_at AS updatedAt
    FROM command_semantic_cache
    WHERE query_key = ${queryKey}
      AND context_key = ${contextKey}
      AND updated_at >= ${now - SEMANTIC_CACHE_TTL_MS}
    LIMIT 1
  `;
  const exactValue = exactRows[0] ? parseCacheValue(exactRows[0].value) : null;

  if (exactRows[0] && exactValue) {
    recordCommandSemanticCacheHit(agent, exactRows[0].id);
    return {
      value: exactValue,
      similarity: 1,
      query: exactRows[0].query,
    };
  }

  const queryEmbedding = await embedCommandQuery(env, queryKey).catch(() => null);
  if (!queryEmbedding) return null;

  const rows = agent.sql<CommandCacheRow>`
    SELECT
      id,
      query,
      query_key AS queryKey,
      embedding_json AS embedding,
      value_json AS value,
      hit_count AS hitCount,
      updated_at AS updatedAt
    FROM command_semantic_cache
    WHERE context_key = ${contextKey}
      AND embedding_model = ${queryEmbedding.model}
      AND updated_at >= ${now - SEMANTIC_CACHE_TTL_MS}
    ORDER BY updated_at DESC
    LIMIT ${SEMANTIC_CACHE_EMBEDDING_CANDIDATES}
  `;

  let best:
    | {
        row: CommandCacheRow;
        value: CommandIntentCacheValue;
        similarity: number;
      }
    | null = null;

  for (const row of rows) {
    const cachedEmbedding = parseEmbedding(row.embedding);
    const value = parseCacheValue(row.value);
    if (!cachedEmbedding || !value) continue;

    const similarity = cosineSimilarity(queryEmbedding.embedding, cachedEmbedding);
    if (!best || similarity > best.similarity) {
      best = { row, value, similarity };
    }
  }

  if (
    !best ||
    !isSemanticCacheHitAllowed(
      best.value,
      input.query,
      input.surfaceContext,
      best.similarity,
    )
  ) {
    return null;
  }

  recordCommandSemanticCacheHit(agent, best.row.id);
  return {
    value: best.value,
    similarity: best.similarity,
    query: best.row.query,
  };
}

export async function storeCommandSemanticCache(
  agent: CommandAgent,
  env: Env,
  input: {
    query: string;
    surfaceContext: CommandSurfaceContext;
    value: CommandIntentCacheValue;
  },
) {
  const queryKey = normalizeCommandSearch(input.query);
  if (!queryKey) return;

  const embedded = await embedCommandQuery(env, queryKey).catch(() => null);
  if (!embedded) return;

  const now = Date.now();
  const contextKey = getSurfaceCacheKey(input.surfaceContext);
  const valueJson = JSON.stringify(input.value);
  const embeddingJson = JSON.stringify(embedded.embedding);

  agent.sql`
    INSERT INTO command_semantic_cache (
      id,
      query,
      query_key,
      context_key,
      embedding_model,
      embedding_json,
      value_json,
      hit_count,
      created_at,
      updated_at
    )
    VALUES (
      ${crypto.randomUUID()},
      ${input.query},
      ${queryKey},
      ${contextKey},
      ${embedded.model},
      ${embeddingJson},
      ${valueJson},
      0,
      ${now},
      ${now}
    )
    ON CONFLICT (query_key, context_key)
    DO UPDATE SET
      query = excluded.query,
      embedding_model = excluded.embedding_model,
      embedding_json = excluded.embedding_json,
      value_json = excluded.value_json,
      updated_at = excluded.updated_at
  `;

  pruneCommandSemanticCache(agent);
}

export function recordCommandSemanticCacheHit(agent: CommandAgent, id: string) {
  agent.sql`
    UPDATE command_semantic_cache
    SET hit_count = hit_count + 1,
      updated_at = ${Date.now()}
    WHERE id = ${id}
  `;
}

export function pruneCommandSemanticCache(agent: CommandAgent) {
  const cutoff = Date.now() - SEMANTIC_CACHE_TTL_MS;

  agent.sql`
    DELETE FROM command_semantic_cache
    WHERE updated_at < ${cutoff}
  `;

  agent.sql`
    DELETE FROM command_semantic_cache
    WHERE id NOT IN (
      SELECT id
      FROM command_semantic_cache
      ORDER BY hit_count DESC, updated_at DESC
      LIMIT ${SEMANTIC_CACHE_LIMIT}
    )
  `;
}
