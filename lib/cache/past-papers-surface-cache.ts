import { createHash, randomUUID } from "node:crypto";
import type { Redis } from "@upstash/redis";
import { getOptionalRedis } from "@/lib/redis";

const CACHE_KEY_PREFIX = "ec:past-papers-surface-cache";
const CACHE_SCHEMA_VERSION = 1;
const NAMESPACE_VERSION_KEY = `${CACHE_KEY_PREFIX}:namespace-version`;
const DEFAULT_CACHE_TTL_SECONDS = 900;
const DEFAULT_LOCK_TTL_SECONDS = 15;
const DEFAULT_WAIT_TIMEOUT_MS = 1200;
const DEFAULT_WAIT_INTERVAL_MS = 80;
const RELEASE_LOCK_SCRIPT =
  "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end";

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
  redis: Redis;
}): Promise<CacheReadResult<T>> {
  const rawValue = await input.redis.get<unknown>(input.cacheKey);
  const parsedValue = parseRedisValue(rawValue, input.deserialize);

  if (parsedValue.type === "miss" && rawValue !== null && rawValue !== undefined) {
    await input.redis.del(input.cacheKey).catch(() => undefined);
  }

  return parsedValue;
}

async function tryAcquireCacheLock(redis: Redis, cacheKey: string) {
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

async function releaseCacheLock(redis: Redis, cacheKey: string, token: string | null) {
  if (!token) {
    return;
  }

  const lockKey = buildLockKey(cacheKey);

  try {
    await redis.eval(RELEASE_LOCK_SCRIPT, [lockKey], [token]);
  } catch (error) {
    console.error("[past-papers-surface-cache] lock release failed", error);
  }
}

async function waitForCacheEntry<T>(input: {
  cacheKey: string;
  deserialize?: DeserializeValue<T>;
  redis: Redis;
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
      console.error("[past-papers-surface-cache] wait read failed", error);
      return { type: "miss" };
    }
  }

  return { type: "miss" };
}

async function storeCacheEntry<T>(input: {
  cacheKey: string;
  redis: Redis;
  ttlSeconds?: number;
  value: T;
}) {
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
  const redis = getOptionalRedis();
  if (!redis) {
    return 0;
  }

  try {
    const rawValue = await redis.get<number | string>(NAMESPACE_VERSION_KEY);
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
  } catch (error) {
    console.error("[past-papers-surface-cache] namespace read failed", error);
    return 0;
  }
}

export async function withPastPapersSurfaceRedisCache<T>(
  input: {
    keyParts: readonly unknown[];
    ttlSeconds?: number;
    deserialize?: DeserializeValue<T>;
  },
  loader: () => Promise<T>,
): Promise<T> {
  const redis = getOptionalRedis();
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
    console.error("[past-papers-surface-cache] cache read failed", error);
    return loader();
  }

  let lockToken: string | null = null;

  try {
    lockToken = await tryAcquireCacheLock(redis, cacheKey);
  } catch (error) {
    console.error("[past-papers-surface-cache] lock acquire failed", error);
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

    try {
      await storeCacheEntry({
        cacheKey,
        redis,
        ttlSeconds: input.ttlSeconds,
        value,
      });
    } catch (error) {
      console.error("[past-papers-surface-cache] fallback write failed", error);
    }

    return value;
  }

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

    try {
      await storeCacheEntry({
        cacheKey,
        redis,
        ttlSeconds: input.ttlSeconds,
        value,
      });
    } catch (error) {
      console.error("[past-papers-surface-cache] cache write failed", error);
    }

    return value;
  } finally {
    await releaseCacheLock(redis, cacheKey, lockToken);
  }
}

export async function invalidatePastPapersSurfaceCache() {
  const redis = getOptionalRedis();
  if (!redis) {
    return null;
  }

  try {
    return await redis.incr(NAMESPACE_VERSION_KEY);
  } catch (error) {
    console.error("[past-papers-surface-cache] namespace bump failed", error);
    return null;
  }
}
