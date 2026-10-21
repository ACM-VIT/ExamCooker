// The entry Worker, OpenNext config and Next server bundle each get their own
// copy of this module. A shared symbol joins their spans for one request.
const TIMINGS = Symbol.for("examcooker.request-timings");
const MAX_SPANS = 512;

export type RequestSpanKind = "routeCache" | "dataCache" | "tags" | "dbConnect" | "dbQuery";
const SPAN_KINDS: RequestSpanKind[] = ["routeCache", "dataCache", "tags", "dbConnect", "dbQuery"];

// [kind, start, end]; end is undefined while the work is still pending.
type Span = [RequestSpanKind, number, number | undefined];
type RequestTiming = {
  startedAt: number;
  spans: Span[];
  droppedSpans: number;
};

function requestTimings(): WeakMap<object, RequestTiming> {
  const runtime = globalThis as typeof globalThis & { [TIMINGS]?: WeakMap<object, RequestTiming> };
  return runtime[TIMINGS] ??= new WeakMap<object, RequestTiming>();
}

export function beginRequestTiming(ctx: object) {
  const timing: RequestTiming = { startedAt: performance.now(), spans: [], droppedSpans: 0 };
  requestTimings().set(ctx, timing);
  return timing;
}

/** Record how long a request waited on one kind of I/O. Untracked contexts pass through. */
export async function timeRequestWork<T>(ctx: object | undefined, kind: RequestSpanKind, work: () => Promise<T>): Promise<T> {
  const timing = ctx ? requestTimings().get(ctx) : undefined;
  if (!timing) return work();
  if (timing.spans.length >= MAX_SPANS) {
    timing.droppedSpans++;
    return work();
  }
  // Register the span before awaiting so a summary taken mid-flight sees it.
  const span: Span = [kind, performance.now(), undefined];
  timing.spans.push(span);
  try {
    return await work();
  } finally {
    span[2] = performance.now();
  }
}

// Workers clocks advance only across I/O, so a union of spans is the time the
// request spent blocked on that kind of I/O. Overlapping reads count once, and
// work still pending at the boundary counts up to the boundary.
function busyMs(spans: Span[], kind: RequestSpanKind, from: number, to: number) {
  const intervals = spans
    .filter(([spanKind]) => spanKind === kind)
    .map(([, start, end]) => [Math.max(start, from), Math.min(end ?? to, to)] as const)
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let coveredUntil = from;
  for (const [start, end] of intervals) {
    if (end <= coveredUntil) continue;
    total += end - Math.max(start, coveredUntil);
    coveredUntil = end;
  }
  return Math.round(total);
}

/**
 * Summarize I/O before response headers and before the response body ended.
 * `endMs` is when the last body chunk was handed to the client, so it includes
 * backpressure from slow readers as well as rendering time.
 */
export function summarizeRequestTiming(timing: RequestTiming, headersAt: number, endedAt: number) {
  const summary: Record<string, number> = {
    headMs: Math.round(headersAt - timing.startedAt),
    endMs: Math.round(endedAt - timing.startedAt),
  };
  if (timing.droppedSpans) summary.droppedSpans = timing.droppedSpans;
  for (const kind of SPAN_KINDS) {
    const count = timing.spans.filter(([spanKind]) => spanKind === kind).length;
    if (count === 0) continue;
    summary[`${kind}N`] = count;
    summary[`${kind}HeadMs`] = busyMs(timing.spans, kind, timing.startedAt, headersAt);
    summary[`${kind}Ms`] = busyMs(timing.spans, kind, timing.startedAt, endedAt);
  }
  return summary;
}
