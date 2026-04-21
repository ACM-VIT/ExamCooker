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

export const PAST_PAPER_EXAM_TAG_CONFIG = {
  "CAT-1": {
    aliases: ["cat1", "cat 1", "cat-1"],
    titlePatterns: [/\bcat[-\s]?1\b/i],
  },
  "CAT-2": {
    aliases: ["cat2", "cat 2", "cat-2"],
    titlePatterns: [/\bcat[-\s]?2\b/i],
  },
  FAT: {
    aliases: ["fat"],
    titlePatterns: [/\bfat(?:\s*2)?\b/i],
  },
} as const satisfies Record<
  PastPaperExamTag,
  {
    aliases: readonly string[];
    titlePatterns: readonly RegExp[];
  }
>;

const EXAM_TAG_BY_NORMALIZED_VALUE = new Map<string, PastPaperExamTag>(
  PAST_PAPER_EXAM_TAGS.flatMap((tag) =>
    [tag, ...PAST_PAPER_EXAM_TAG_CONFIG[tag].aliases].map((value) => [
      normalizeExamTagValue(value),
      tag,
    ]),
  ),
);

function normalizeExamTagValue(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function canonicalizePastPaperExamTag(
  value: string,
): PastPaperExamTag | null {
  return EXAM_TAG_BY_NORMALIZED_VALUE.get(normalizeExamTagValue(value)) ?? null;
}

export function getPastPaperExamTagAliases(tag: PastPaperExamTag) {
  return PAST_PAPER_EXAM_TAG_CONFIG[tag].aliases;
}

export function getPastPaperExamTagSearchTokens(tag: PastPaperExamTag) {
  return Array.from(new Set([tag, ...PAST_PAPER_EXAM_TAG_CONFIG[tag].aliases]));
}

export function getPastPaperExamTagFromTitle(
  title: string,
): PastPaperExamTag | null {
  for (const tag of PAST_PAPER_EXAM_TAGS) {
    if (
      PAST_PAPER_EXAM_TAG_CONFIG[tag].titlePatterns.some((pattern) =>
        pattern.test(title),
      )
    ) {
      return tag;
    }
  }

  return null;
}
