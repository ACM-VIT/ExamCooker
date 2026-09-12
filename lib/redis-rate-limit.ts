import "server-only";

import { createHash } from "node:crypto";
import { getOptionalAppState } from "@/lib/app-state";

function hashIdentifier(identifier: string) {
  return createHash("sha256").update(identifier).digest("hex");
}

export async function checkSlidingWindowRateLimit(input: {
  identifier: string;
  limit: number;
  prefix: string;
  windowMs: number;
}) {
  const redis = getOptionalAppState();
  if (!redis) {
    return { enabled: false, success: true } as const;
  }

  const now = Date.now();
  const key = `${input.prefix}:${hashIdentifier(input.identifier)}`;
  const result = await redis.slidingWindow(key, now, input.windowMs, input.limit);

  const allowed = Array.isArray(result) && Number(result[0]) === 1;
  return { enabled: true, success: allowed } as const;
}
