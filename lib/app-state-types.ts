export type StateOperation =
  | { type: "get" | "del" | "incr" | "hgetall"; key: string }
  | { type: "set"; key: string; value: string; ex?: number; nx?: boolean }
  | { type: "releaseLock"; key: string; token: string }
  | { type: "slidingWindow"; key: string; now: number; windowMs: number; limit: number }
  | { type: "recordVote"; key: string; feedbackKey: string; vote: "up" | "down"; updatedAt: string; ttlSeconds: number };

// All voters and the total for a generation must use the same atomic object.
export function stateObjectName(key: string) {
  const match = /^ec:pdf-markdown:(?:vote|feedback):([^:]+):([^:]+)/.exec(key);
  return match ? `pdf-feedback:${match[1]}:${match[2]}` : key;
}

export function isCachePayload(key: string) {
  return key.startsWith("ec:pdf-markdown:entry:") ||
    (key.startsWith("ec:past-papers-surface-cache:v") && !key.endsWith(":lock"));
}
