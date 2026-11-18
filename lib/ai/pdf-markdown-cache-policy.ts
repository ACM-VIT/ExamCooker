export type PdfMarkdownCacheMode = "default" | "refresh";

/**
 * Students can retry a conversion, but only a moderator may discard a cached
 * generation that is still being served. A student's retry reads the cache
 * first, so it regenerates only a missing or flagged generation.
 */
export function resolvePdfMarkdownCacheMode(
  requested: PdfMarkdownCacheMode | undefined,
  role: string | null | undefined,
): PdfMarkdownCacheMode {
  return requested === "refresh" && role === "MODERATOR" ? "refresh" : "default";
}

/**
 * The generation a writer saw before it started. `undefined` replaces any
 * entry (a moderator refresh); `null` means the writer saw no entry.
 */
export type ExpectedPdfMarkdownGeneration = string | null | undefined;

/**
 * A finished generation replaces the stored one only if the stored one is
 * still the one this writer observed. Otherwise another writer finished first,
 * and overwriting it would discard that generation and the votes cast on it.
 * A `null` current generation means no usable entry (absent, expired, deleted
 * or unreadable), which any writer may fill.
 */
export function canReplacePdfMarkdownGeneration(
  currentGenerationId: string | null,
  expected: ExpectedPdfMarkdownGeneration,
) {
  if (expected === undefined || currentGenerationId === null) return true;
  return currentGenerationId === expected;
}

/**
 * Feedback describes one generation, which exists only while its cache entry
 * does. Votes and totals share the entry's absolute expiry, so neither a
 * voter's record nor the totals outlive the other.
 */
export function getPdfMarkdownFeedbackTtlSeconds(input: {
  entryTtlSeconds: number;
  generatedAt: string;
  now: number;
}) {
  const generatedAt = Date.parse(input.generatedAt);
  if (!Number.isFinite(generatedAt)) return input.entryTtlSeconds;
  const remainingMs = generatedAt + input.entryTtlSeconds * 1000 - input.now;
  return Math.min(
    input.entryTtlSeconds,
    Math.max(Math.ceil(remainingMs / 1000), 1),
  );
}
