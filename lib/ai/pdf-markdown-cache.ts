import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  PdfPaperDocumentSchema,
  buildPdfPaperMarkdown,
} from "@/lib/ai/pdf-markdown";
import type { PdfPaperDocument } from "@/lib/ai/pdf-markdown";
import type {
  PdfMarkdownCacheMetadata,
  PdfMarkdownFeedbackSummary,
  PdfMarkdownFeedbackVote,
} from "@/lib/ai/pdf-markdown-cache-types";
import { getOptionalRedis } from "@/lib/redis";

const CACHE_ENTRY_VERSION = 1;
const CACHE_KEY_PREFIX = "ec:pdf-markdown";
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_FEEDBACK_TTL_SECONDS = 60 * 60 * 24 * 180;
const GENERATION_LOCK_TTL_SECONDS = 120;
const WAIT_FOR_CACHE_TIMEOUT_MS = 7000;
const WAIT_FOR_CACHE_INTERVAL_MS = 500;
const RELEASE_LOCK_SCRIPT =
  "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end";
const RECORD_FEEDBACK_SCRIPT = `
local voteKey = KEYS[1]
local feedbackKey = KEYS[2]
local nextVote = ARGV[1]
local updatedAt = ARGV[2]
local ttlSeconds = tonumber(ARGV[3])
local previousVote = redis.call("GET", voteKey)
local upvotes = tonumber(redis.call("HGET", feedbackKey, "upvotes") or "0")
local downvotes = tonumber(redis.call("HGET", feedbackKey, "downvotes") or "0")

if previousVote == nextVote then
  return { previousVote or "", tostring(upvotes), tostring(downvotes) }
end

redis.call("SET", voteKey, nextVote, "EX", ttlSeconds)

if previousVote == "up" then
  upvotes = math.max(upvotes - 1, 0)
elseif previousVote == "down" then
  downvotes = math.max(downvotes - 1, 0)
end

if nextVote == "up" then
  upvotes = upvotes + 1
else
  downvotes = downvotes + 1
end

redis.call(
  "HSET",
  feedbackKey,
  "updatedAt",
  updatedAt,
  "upvotes",
  upvotes,
  "downvotes",
  downvotes
)
redis.call("EXPIRE", feedbackKey, ttlSeconds)

return { previousVote or "", tostring(upvotes), tostring(downvotes) }
`;

const CacheEntrySchema = z.object({
  cacheKey: z.string().regex(/^[a-f0-9]{64}$/),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  fileName: z.string().min(1).max(240),
  fileUrl: z.string().url(),
  generatedAt: z.string().min(1),
  generationId: z.string().regex(/^[a-f0-9]{64}$/),
  markdown: z.string().min(1),
  modelId: z.string().min(1),
  paper: PdfPaperDocumentSchema,
  promptFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  version: z.literal(CACHE_ENTRY_VERSION),
});

export type PdfMarkdownCacheEntry = z.infer<typeof CacheEntrySchema>;

type CacheLookupInput = {
  cacheKey: string;
  contentHash: string;
  modelId: string;
  promptFingerprint: string;
  voterId?: string;
};

type CacheStoreInput = CacheLookupInput & {
  fileName: string;
  fileUrl: string;
  markdown: string;
  paper: PdfPaperDocument;
};

type CacheHitResult = {
  entry: PdfMarkdownCacheEntry;
  metadata: PdfMarkdownCacheMetadata;
  type: "hit";
};

type CacheMissResult = {
  cacheKey: string;
  metadata: PdfMarkdownCacheMetadata;
  type: "disabled" | "miss" | "bypassed";
};

export type PdfMarkdownCacheLookupResult = CacheHitResult | CacheMissResult;

function parseSecondsEnv(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function entryRedisKey(cacheKey: string) {
  return `${CACHE_KEY_PREFIX}:entry:${cacheKey}`;
}

function feedbackRedisKey(cacheKey: string, generationId: string) {
  return `${CACHE_KEY_PREFIX}:feedback:${cacheKey}:${generationId}`;
}

function voteRedisKey(
  cacheKey: string,
  generationId: string,
  voterId: string,
) {
  return `${CACHE_KEY_PREFIX}:vote:${cacheKey}:${generationId}:${hashText(
    voterId,
  ).slice(0, 32)}`;
}

function lockRedisKey(cacheKey: string) {
  return `${CACHE_KEY_PREFIX}:lock:${cacheKey}`;
}

function emptyFeedback(
  userVote: PdfMarkdownFeedbackVote | null = null,
): PdfMarkdownFeedbackSummary {
  return {
    downvotes: 0,
    status: "unreviewed",
    totalVotes: 0,
    upvotes: 0,
    userVote,
  };
}

function normalizeCount(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : 0;

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(parsed, 0);
}

function normalizeVote(value: unknown): PdfMarkdownFeedbackVote | null {
  return value === "up" || value === "down" ? value : null;
}

export function getPdfMarkdownAccuracyStatus(input: {
  downvotes: number;
  upvotes: number;
}): PdfMarkdownFeedbackSummary["status"] {
  if (input.downvotes >= 3 && input.downvotes >= input.upvotes + 2) {
    return "needs_review";
  }

  if (input.upvotes >= 2 && input.upvotes >= input.downvotes + 2) {
    return "community_verified";
  }

  if (input.upvotes > 0) {
    return "helpful";
  }

  return "unreviewed";
}

function buildFeedbackSummary(input: {
  downvotes: number;
  upvotes: number;
  userVote?: PdfMarkdownFeedbackVote | null;
}): PdfMarkdownFeedbackSummary {
  const upvotes = Math.max(input.upvotes, 0);
  const downvotes = Math.max(input.downvotes, 0);

  return {
    downvotes,
    status: getPdfMarkdownAccuracyStatus({ downvotes, upvotes }),
    totalVotes: upvotes + downvotes,
    upvotes,
    userVote: input.userVote ?? null,
  };
}

function shouldServeFeedback(feedback: PdfMarkdownFeedbackSummary) {
  return feedback.status !== "needs_review";
}

function buildCacheMetadata(input: {
  cacheKey?: string;
  contentHash?: string;
  feedback?: PdfMarkdownFeedbackSummary;
  generatedAt?: string;
  generationId?: string;
  model?: string;
  reason?: string;
  source: PdfMarkdownCacheMetadata["source"];
  status: PdfMarkdownCacheMetadata["status"];
}): PdfMarkdownCacheMetadata {
  return {
    cacheKey: input.cacheKey,
    contentHash: input.contentHash,
    feedback: input.feedback ?? emptyFeedback(),
    generatedAt: input.generatedAt,
    generationId: input.generationId,
    model: input.model,
    reason: input.reason,
    source: input.source,
    status: input.status,
  };
}

function parseCacheEntryValue(value: unknown) {
  if (!value) {
    return null;
  }

  try {
    return CacheEntrySchema.safeParse(
      typeof value === "string" ? JSON.parse(value) : value,
    );
  } catch {
    return null;
  }
}

async function getUserVote(input: {
  cacheKey: string;
  generationId: string;
  voterId?: string;
}) {
  if (!input.voterId) {
    return null;
  }

  const redis = getOptionalRedis();
  if (!redis) {
    return null;
  }

  try {
    return normalizeVote(
      await redis.get<string>(
        voteRedisKey(input.cacheKey, input.generationId, input.voterId),
      ),
    );
  } catch (error) {
    console.error("[pdf-markdown-cache] user vote read failed", error);
    return null;
  }
}

export function getPdfMarkdownContentHash(pdfBuffer: Buffer) {
  return createHash("sha256").update(pdfBuffer).digest("hex");
}

export function getPdfMarkdownPromptFingerprint(prompt: string) {
  return hashText(prompt);
}

export function getPdfMarkdownCacheKey(input: {
  contentHash: string;
  modelId: string;
  promptFingerprint: string;
}) {
  return hashText(
    [
      "pdf-markdown-cache-v1",
      input.contentHash,
      input.modelId,
      input.promptFingerprint,
    ].join("\n"),
  );
}

export async function readPdfMarkdownFeedback(input: {
  cacheKey: string;
  generationId: string;
  voterId?: string;
}): Promise<PdfMarkdownFeedbackSummary> {
  const redis = getOptionalRedis();
  if (!redis) {
    return emptyFeedback();
  }

  try {
    const [rawFeedback, userVote] = await Promise.all([
      redis.hgetall<Record<string, unknown>>(
        feedbackRedisKey(input.cacheKey, input.generationId),
      ),
      getUserVote(input),
    ]);

    return buildFeedbackSummary({
      downvotes: normalizeCount(rawFeedback?.downvotes),
      upvotes: normalizeCount(rawFeedback?.upvotes),
      userVote,
    });
  } catch (error) {
    console.error("[pdf-markdown-cache] feedback read failed", error);
    return emptyFeedback();
  }
}

export async function readPdfMarkdownCache(
  input: CacheLookupInput,
): Promise<PdfMarkdownCacheLookupResult> {
  const redis = getOptionalRedis();
  if (!redis) {
    return {
      cacheKey: input.cacheKey,
      metadata: buildCacheMetadata({
        cacheKey: input.cacheKey,
        contentHash: input.contentHash,
        model: input.modelId,
        source: "live",
        status: "disabled",
      }),
      type: "disabled",
    };
  }

  let rawEntry: unknown = null;

  try {
    rawEntry = await redis.get<unknown>(entryRedisKey(input.cacheKey));
  } catch (error) {
    console.error("[pdf-markdown-cache] cache read failed", error);
    return {
      cacheKey: input.cacheKey,
      metadata: buildCacheMetadata({
        cacheKey: input.cacheKey,
        contentHash: input.contentHash,
        model: input.modelId,
        reason: "redis_read_failed",
        source: "live",
        status: "disabled",
      }),
      type: "disabled",
    };
  }

  if (!rawEntry) {
    return {
      cacheKey: input.cacheKey,
      metadata: buildCacheMetadata({
        cacheKey: input.cacheKey,
        contentHash: input.contentHash,
        model: input.modelId,
        source: "live",
        status: "miss",
      }),
      type: "miss",
    };
  }

  let entry: PdfMarkdownCacheEntry;

  const parsedEntry = parseCacheEntryValue(rawEntry);
  if (!parsedEntry?.success) {
    console.error("[pdf-markdown-cache] invalid cache entry");
    await redis.del(entryRedisKey(input.cacheKey)).catch(() => undefined);
    return {
      cacheKey: input.cacheKey,
      metadata: buildCacheMetadata({
        cacheKey: input.cacheKey,
        contentHash: input.contentHash,
        model: input.modelId,
        reason: "invalid_cache_entry",
        source: "live",
        status: "miss",
      }),
      type: "miss",
    };
  }
  entry = parsedEntry.data;

  const expectedMarkdown = buildPdfPaperMarkdown(entry.paper);
  const isExpectedEntry =
    entry.cacheKey === input.cacheKey &&
    entry.contentHash === input.contentHash &&
    entry.modelId === input.modelId &&
    entry.promptFingerprint === input.promptFingerprint &&
    entry.markdown === expectedMarkdown;

  if (!isExpectedEntry) {
    await redis.del(entryRedisKey(input.cacheKey)).catch(() => undefined);
    return {
      cacheKey: input.cacheKey,
      metadata: buildCacheMetadata({
        cacheKey: input.cacheKey,
        contentHash: input.contentHash,
        model: input.modelId,
        reason: "cache_entry_mismatch",
        source: "live",
        status: "miss",
      }),
      type: "miss",
    };
  }

  const feedback = await readPdfMarkdownFeedback({
    cacheKey: entry.cacheKey,
    generationId: entry.generationId,
    voterId: input.voterId,
  });

  if (!shouldServeFeedback(feedback)) {
    return {
      cacheKey: input.cacheKey,
      metadata: buildCacheMetadata({
        cacheKey: input.cacheKey,
        contentHash: input.contentHash,
        feedback,
        generatedAt: entry.generatedAt,
        generationId: entry.generationId,
        model: input.modelId,
        reason: "flagged_by_students",
        source: "live",
        status: "bypassed",
      }),
      type: "bypassed",
    };
  }

  return {
    entry,
    metadata: buildCacheMetadata({
      cacheKey: input.cacheKey,
      contentHash: input.contentHash,
      feedback,
      generatedAt: entry.generatedAt,
      generationId: entry.generationId,
      model: input.modelId,
      source: "cache",
      status: "hit",
    }),
    type: "hit",
  };
}

export async function storePdfMarkdownCache(
  input: CacheStoreInput,
): Promise<PdfMarkdownCacheMetadata> {
  const redis = getOptionalRedis();
  // Feedback belongs to a particular generation attempt, even if a retry
  // happens to produce byte-identical Markdown.
  const generationId = hashText(`${randomUUID()}\n${input.markdown}`);

  if (!redis) {
    return buildCacheMetadata({
      cacheKey: input.cacheKey,
      contentHash: input.contentHash,
      generationId,
      model: input.modelId,
      source: "live",
      status: "disabled",
    });
  }

  if (!input.paper.questions.length || !input.markdown.trim()) {
    return buildCacheMetadata({
      cacheKey: input.cacheKey,
      contentHash: input.contentHash,
      generationId,
      model: input.modelId,
      reason: "empty_generation",
      source: "live",
      status: "skipped",
    });
  }

  const entry: PdfMarkdownCacheEntry = {
    cacheKey: input.cacheKey,
    contentHash: input.contentHash,
    fileName: input.fileName,
    fileUrl: input.fileUrl,
    generatedAt: new Date().toISOString(),
    generationId,
    markdown: input.markdown,
    modelId: input.modelId,
    paper: input.paper,
    promptFingerprint: input.promptFingerprint,
    version: CACHE_ENTRY_VERSION,
  };

  try {
    await redis.set(entryRedisKey(input.cacheKey), JSON.stringify(entry), {
      ex: parseSecondsEnv("PDF_MARKDOWN_CACHE_TTL_SECONDS", DEFAULT_CACHE_TTL_SECONDS),
    });
  } catch (error) {
    console.error("[pdf-markdown-cache] cache write failed", error);
    return buildCacheMetadata({
      cacheKey: input.cacheKey,
      contentHash: input.contentHash,
      generatedAt: entry.generatedAt,
      generationId,
      model: input.modelId,
      reason: "redis_write_failed",
      source: "live",
      status: "disabled",
    });
  }

  return buildCacheMetadata({
    cacheKey: input.cacheKey,
    contentHash: input.contentHash,
    feedback: emptyFeedback(),
    generatedAt: entry.generatedAt,
    generationId,
    model: input.modelId,
    source: "live",
    status: "stored",
  });
}

export async function tryAcquirePdfMarkdownGenerationLock(cacheKey: string) {
  const redis = getOptionalRedis();
  if (!redis) {
    return null;
  }

  const token = randomUUID();

  try {
    const result = await redis.set(lockRedisKey(cacheKey), token, {
      ex: GENERATION_LOCK_TTL_SECONDS,
      nx: true,
    });

    return result === "OK" ? token : null;
  } catch (error) {
    console.error("[pdf-markdown-cache] lock acquire failed", error);
    return null;
  }
}

export async function releasePdfMarkdownGenerationLock(
  cacheKey: string,
  token: string | null,
) {
  const redis = getOptionalRedis();
  if (!redis || !token) {
    return;
  }

  try {
    await redis.eval(RELEASE_LOCK_SCRIPT, [lockRedisKey(cacheKey)], [token]);
  } catch (error) {
    console.error("[pdf-markdown-cache] lock release failed", error);
  }
}

export async function waitForPdfMarkdownCache(
  input: CacheLookupInput,
): Promise<CacheHitResult | null> {
  const deadline = Date.now() + WAIT_FOR_CACHE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) =>
      setTimeout(resolve, WAIT_FOR_CACHE_INTERVAL_MS),
    );

    const result = await readPdfMarkdownCache(input);
    if (result.type === "hit") {
      return result;
    }
  }

  return null;
}

export async function recordPdfMarkdownFeedback(input: {
  cacheKey: string;
  generationId: string;
  voterId: string;
  vote: PdfMarkdownFeedbackVote;
}): Promise<PdfMarkdownFeedbackSummary | null> {
  const redis = getOptionalRedis();
  if (!redis) {
    return null;
  }

  try {
    const entry = await redis.get<unknown>(entryRedisKey(input.cacheKey));
    const parsedEntry = parseCacheEntryValue(entry);

    if (!parsedEntry?.success) {
      return null;
    }

    if (parsedEntry.data.generationId !== input.generationId) {
      return null;
    }

    const feedbackKey = feedbackRedisKey(input.cacheKey, input.generationId);
    const voteKey = voteRedisKey(
      input.cacheKey,
      input.generationId,
      input.voterId,
    );
    const ttlSeconds = parseSecondsEnv(
      "PDF_MARKDOWN_FEEDBACK_TTL_SECONDS",
      DEFAULT_FEEDBACK_TTL_SECONDS,
    );
    const result = await redis.eval<[string, string, string], unknown>(
      RECORD_FEEDBACK_SCRIPT,
      [voteKey, feedbackKey],
      [input.vote, new Date().toISOString(), String(ttlSeconds)],
    );

    if (!Array.isArray(result)) {
      return readPdfMarkdownFeedback({
        cacheKey: input.cacheKey,
        generationId: input.generationId,
        voterId: input.voterId,
      });
    }

    return buildFeedbackSummary({
      downvotes: normalizeCount(result[2]),
      upvotes: normalizeCount(result[1]),
      userVote: input.vote,
    });
  } catch (error) {
    console.error("[pdf-markdown-cache] feedback write failed", error);
    return null;
  }
}
