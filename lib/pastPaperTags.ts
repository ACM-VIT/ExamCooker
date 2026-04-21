export const PAST_PAPER_SLOT_TAGS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
  "D1",
  "D2",
  "E1",
  "E2",
  "F1",
  "F2",
  "G1",
  "G2",
] as const;

export const PAST_PAPER_EXAM_TAGS = ["CAT-1", "CAT-2", "FAT"] as const;

export type PastPaperExamTag = (typeof PAST_PAPER_EXAM_TAGS)[number];

const PAST_PAPER_EXAM_TAG_ALIASES: Record<PastPaperExamTag, readonly string[]> = {
  "CAT-1": ["cat1", "cat 1", "cat-1"],
  "CAT-2": ["cat2", "cat 2", "cat-2"],
  FAT: ["fat"],
};

const PAST_PAPER_EXAM_TAG_SEARCH_TOKENS: Record<
  PastPaperExamTag,
  readonly string[]
> = {
  "CAT-1": ["CAT-1", "CAT 1", "CAT1"],
  "CAT-2": ["CAT-2", "CAT 2", "CAT2"],
  FAT: ["FAT", "FAT 2"],
};

const EXAM_TAG_LOOKUP = new Map<string, PastPaperExamTag>();

for (const tag of PAST_PAPER_EXAM_TAGS) {
  EXAM_TAG_LOOKUP.set(normalizeExamTagCandidate(tag), tag);
  PAST_PAPER_EXAM_TAG_ALIASES[tag].forEach((alias) => {
    EXAM_TAG_LOOKUP.set(normalizeExamTagCandidate(alias), tag);
  });
}

function normalizeExamTagCandidate(value: string) {
  return value.trim().toLowerCase().replace(/[-_\s]+/g, "");
}

export function canonicalizePastPaperExamTag(
  value: string,
): PastPaperExamTag | null {
  return EXAM_TAG_LOOKUP.get(normalizeExamTagCandidate(value)) ?? null;
}

export function getPastPaperExamTagAliases(tag: PastPaperExamTag) {
  return PAST_PAPER_EXAM_TAG_ALIASES[tag];
}

export function getPastPaperExamTagSearchTokens(tag: PastPaperExamTag) {
  return PAST_PAPER_EXAM_TAG_SEARCH_TOKENS[tag];
}

export function getPastPaperExamTagFromTitle(
  title: string,
): PastPaperExamTag | null {
  if (/\bcat[-\s]?1\b/i.test(title)) return "CAT-1";
  if (/\bcat[-\s]?2\b/i.test(title)) return "CAT-2";
  if (/\bfat(?:\s*2)?\b/i.test(title)) return "FAT";
  return null;
}
