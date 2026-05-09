import { Redis } from "@upstash/redis";

let redisClient: Redis | null | undefined;

function readRedisEnv() {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (upstashUrl && upstashToken) {
    return { token: upstashToken, url: upstashUrl };
  }

  const kvUrl = process.env.KV_REST_API_URL?.trim();
  const kvToken = process.env.KV_REST_API_TOKEN?.trim();
  if (kvUrl && kvToken) {
    return { token: kvToken, url: kvUrl };
  }

  return { token: "", url: "" };
}

export function getOptionalRedis() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const { token, url } = readRedisEnv();
  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({
    token,
    url,
  });

  return redisClient;
}
