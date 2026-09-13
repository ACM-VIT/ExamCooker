import { createHash, randomUUID } from "node:crypto";
import type { AppStateClient } from "@/lib/app-state";
import { getOptionalAppState } from "@/lib/app-state";

const CACHE_KEY_PREFIX = "ec:past-papers-surface-cache";
const CACHE_SCHEMA_VERSION = 2;
const NAMESPACE_VERSION_KEY = `${CACHE_KEY_PREFIX}:namespace-version`;
const DEFAULT_CACHE_TTL_SECONDS = 900;
const DEFAULT_LOCK_TTL_SECONDS = 15;
const DEFAULT_WAIT_TIMEOUT_MS = 1200;
const DEFAULT_WAIT_INTERVAL_MS = 80;
type CacheHit<T> = {
  type: "hit";
  value: T;
};

type CacheMiss = {
  type: "miss";
};

type CacheReadResult<T> = CacheHit<T> | CacheMiss;

type DeserializeValue<T> = (value: unknown) => T;

function parsePositiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function formatRecoverableCacheError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

const loggedRecoverableCacheWarnings = new Set<string>();

function warnRecoverableCacheError(label: string, error: unknown) {
  const message = formatRecoverableCacheError(error);
  const warningKey = `${label}: ${message}`;

  if (loggedRecoverableCacheWarnings.has(warningKey)) {
    return;
  }

  loggedRecoverableCacheWarnings.add(warningKey);
  console.warn(`[past-papers-surface-cache] ${warningKey}`);
}

function normalizeStableValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeStableValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeStableValue(entry)]),
    );
  }

  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeStableValue(value));
}

function buildEntryKey(namespaceVersion: number, keyParts: readonly unknown[]) {
  const keyHash = hashText(stableStringify(keyParts));
  return `${CACHE_KEY_PREFIX}:v${CACHE_SCHEMA_VERSION}:n${namespaceVersion}:${keyHash}`;
}

function buildLockKey(cacheKey: string) {
  return `${cacheKey}:lock`;
}

function parseRedisValue<T>(
  rawValue: unknown,
  deserialize?: DeserializeValue<T>,
): CacheReadResult<T> {
  if (rawValue === null || rawValue === undefined) {
    return { type: "miss" };
  }

  try {
    const parsedValue =
      typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;

    return {
      type: "hit",
      value: deserialize ? deserialize(parsedValue) : (parsedValue as T),
    };
  } catch {
    return { type: "miss" };
  }
}

async function readCacheEntry<T>(input: {
  cacheKey: string;
  deserialize?: DeserializeValue<T>;
  redis: AppStateClient;
}): Promise<CacheReadResult<T>> {
  const rawValue = await input.redis.get<unknown>(input.cacheKey);
  const parsedValue = parseRedisValue(rawValue, input.deserialize);

  if (parsedValue.type === "miss" && rawValue !== null && rawValue !== undefined) {
    await input.redis.del(input.cacheKey).catch(() => undefined);
  }

  return parsedValue;
}

async function tryAcquireCacheLock(redis: AppStateClient, cacheKey: string) {
  const token = randomUUID();
  const result = await redis.set(buildLockKey(cacheKey), token, {
    ex: parsePositiveIntegerEnv(
      "PAST_PAPERS_SURFACE_CACHE_LOCK_TTL_SECONDS",
      DEFAULT_LOCK_TTL_SECONDS,
    ),
    nx: true,
  });

  return result === "OK" ? token : null;
}

async function releaseCacheLock(
  redis: AppStateClient,
  cacheKey: string,
  token: string | null,
) {
  if (!token) {
    return;
  }

  const lockKey = buildLockKey(cacheKey);

  try {
    await redis.releaseLock(lockKey, token);
  } catch (error) {
    warnRecoverableCacheError("lock release failed", error);
  }
}

async function waitForCacheEntry<T>(input: {
  cacheKey: string;
  deserialize?: DeserializeValue<T>;
  redis: AppStateClient;
}): Promise<CacheReadResult<T>> {
  const deadline =
    Date.now() +
    parsePositiveIntegerEnv(
      "PAST_PAPERS_SURFACE_CACHE_WAIT_TIMEOUT_MS",
      DEFAULT_WAIT_TIMEOUT_MS,
    );
  const intervalMs = parsePositiveIntegerEnv(
    "PAST_PAPERS_SURFACE_CACHE_WAIT_INTERVAL_MS",
    DEFAULT_WAIT_INTERVAL_MS,
  );

  while (Date.now() < deadline) {
    await sleep(intervalMs);

    try {
      const cachedValue = await readCacheEntry(input);
      if (cachedValue.type === "hit") {
        return cachedValue;
      }
    } catch (error) {
      warnRecoverableCacheError("wait read failed", error);
      return { type: "miss" };
    }
  }

  return { type: "miss" };
}

async function storeCacheEntry<T>(input: {
  cacheKey: string;
  redis: AppStateClient;
  ttlSeconds?: number;
  value: T;
  cacheNull?: boolean;
}) {
  // A temporary database/cache miss must not become a shared 404 for a real
  // paper. Successful reads are worth sharing; absence is cheap to recheck.
  if (input.value === undefined || (input.value === null && !input.cacheNull)) {
    return;
  }

  await input.redis.set(input.cacheKey, JSON.stringify(input.value), {
    ex:
      input.ttlSeconds ??
      parsePositiveIntegerEnv(
        "PAST_PAPERS_SURFACE_CACHE_TTL_SECONDS",
        DEFAULT_CACHE_TTL_SECONDS,
      ),
  });
}

async function readNamespaceVersion() {
  const redis = getOptionalAppState();
  if (!redis) {
    return 0;
  }

  try {
    const rawValue = await redis.get<number | string>(NAMESPACE_VERSION_KEY);
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
  } catch (error) {
    warnRecoverableCacheError("namespace read failed", error);
    return 0;
  }
}

async function finishCacheWrite(redis: AppStateClient, write: Promise<void>) {
  if (redis.deferCacheWrite) {
    try {
      redis.deferCacheWrite(write);
      return;
    } catch (error) {
      // If lifetime registration fails, finish the write before returning.
      warnRecoverableCacheError("background write registration failed", error);
    }
  }
  await write;
}

export async function withPastPapersSurfaceRedisCache<T>(
  input: {
    keyParts: readonly unknown[];
    ttlSeconds?: number;
    deserialize?: DeserializeValue<T>;
    // Opt in only when null is a successful optional lookup, not a missing resource.
    cacheNull?: boolean;
  },
  loader: () => Promise<T>,
): Promise<T> {
  const redis = getOptionalAppState();
  if (!redis) {
    return loader();
  }

  const cacheKey = buildEntryKey(await readNamespaceVersion(), input.keyParts);

  try {
    const cachedValue = await readCacheEntry({
      cacheKey,
      deserialize: input.deserialize,
      redis,
    });

    if (cachedValue.type === "hit") {
      return cachedValue.value;
    }
  } catch (error) {
    warnRecoverableCacheError("cache read failed", error);
    return loader();
  }

  let lockToken: string | null = null;

  try {
    lockToken = await tryAcquireCacheLock(redis, cacheKey);
  } catch (error) {
    warnRecoverableCacheError("lock acquire failed", error);
  }

  if (!lockToken) {
    const waitedValue = await waitForCacheEntry({
      cacheKey,
      deserialize: input.deserialize,
      redis,
    });

    if (waitedValue.type === "hit") {
      return waitedValue.value;
    }

    const value = await loader();

    const write = storeCacheEntry({
      cacheKey,
      redis,
      ttlSeconds: input.ttlSeconds,
      cacheNull: input.cacheNull,
      value,
    }).catch((error) => {
      warnRecoverableCacheError("fallback write failed", error);
    });
    await finishCacheWrite(redis, write);

    return value;
  }

  let cleanupTransferred = false;
  try {
    const cachedValue = await readCacheEntry({
      cacheKey,
      deserialize: input.deserialize,
      redis,
    });
    if (cachedValue.type === "hit") {
      return cachedValue.value;
    }

    const value = await loader();

    const write = storeCacheEntry({
      cacheKey,
      redis,
      ttlSeconds: input.ttlSeconds,
      cacheNull: input.cacheNull,
      value,
    }).catch((error) => {
      warnRecoverableCacheError("cache write failed", error);
    }).finally(() => releaseCacheLock(redis, cacheKey, lockToken));

    // The response can use the loaded data immediately. The fill owns the lock
    // until persistence finishes, so another visitor cannot race its write.
    cleanupTransferred = true;
    await finishCacheWrite(redis, write);

    return value;
  } finally {
    if (!cleanupTransferred) await releaseCacheLock(redis, cacheKey, lockToken);
  }
}

export async function invalidatePastPapersSurfaceCache() {
  const redis = getOptionalAppState();
  if (!redis) {
    return null;
  }

  try {
    return await redis.incr(NAMESPACE_VERSION_KEY);
  } catch (error) {
    warnRecoverableCacheError("namespace bump failed", error);
    return null;
  }
}
