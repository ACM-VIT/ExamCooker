import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { getOptionalRedis } from "@/lib/redis";

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call("ZREMRANGEBYSCORE", key, 0, now - window)
local count = redis.call("ZCARD", key)

if count >= limit then
  redis.call("PEXPIRE", key, window)
  return {0, count}
end

redis.call("ZADD", key, now, member)
redis.call("PEXPIRE", key, window)
return {1, count + 1}
`;

function hashIdentifier(identifier: string) {
  return createHash("sha256").update(identifier).digest("hex");
}

export async function checkSlidingWindowRateLimit(input: {
  identifier: string;
  limit: number;
  prefix: string;
  windowMs: number;
}) {
  const redis = getOptionalRedis();
  if (!redis) {
    return { enabled: false, success: true } as const;
  }

  const now = Date.now();
  const key = `${input.prefix}:${hashIdentifier(input.identifier)}`;
  const result = await redis.eval<string[], unknown>(
    SLIDING_WINDOW_SCRIPT,
    [key],
    [String(now), String(input.windowMs), String(input.limit), `${now}:${randomUUID()}`],
  );

  const allowed = Array.isArray(result) && Number(result[0]) === 1;
  return { enabled: true, success: allowed } as const;
}
