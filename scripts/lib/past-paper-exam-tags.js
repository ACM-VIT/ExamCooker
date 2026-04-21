const EXAM_TAGS = [
  {
    label: "CAT-1",
    aliases: ["cat1", "cat 1", "cat-1"],
    titlePatterns: [/\bcat[-\s]?1\b/i],
  },
  {
    label: "CAT-2",
    aliases: ["cat2", "cat 2", "cat-2"],
    titlePatterns: [/\bcat[-\s]?2\b/i],
  },
  {
    label: "FAT",
    aliases: ["fat"],
    titlePatterns: [/\bfat(?:\s*2)?\b/i],
  },
];

const EXAM_TAG_BY_NORMALIZED_VALUE = new Map(
  EXAM_TAGS.flatMap((tag) =>
    [tag.label, ...tag.aliases].map((value) => [
      normalizeExamTagValue(value),
      tag.label,
    ]),
  ),
);

function normalizeExamTagValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function canonicalizeExamTag(value) {
  return EXAM_TAG_BY_NORMALIZED_VALUE.get(normalizeExamTagValue(value)) || null;
}

function detectExamTagFromTitle(title) {
  const value = String(title || "");
  for (const tag of EXAM_TAGS) {
    if (tag.titlePatterns.some((pattern) => pattern.test(value))) {
      return tag.label;
    }
  }
  return null;
}

function mergeAliases(existingAliases, canonicalAliases) {
  const seen = new Set();
  const merged = [];

  for (const alias of [...(existingAliases || []), ...(canonicalAliases || [])]) {
    const value = String(alias || "").trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    merged.push(value);
  }

  return merged;
}

function createExamTypeCounter() {
  return Object.fromEntries(EXAM_TAGS.map((tag) => [tag.label, 0]));
}

module.exports = {
  EXAM_TAGS,
  canonicalizeExamTag,
  createExamTypeCounter,
  detectExamTagFromTitle,
  mergeAliases,
};
