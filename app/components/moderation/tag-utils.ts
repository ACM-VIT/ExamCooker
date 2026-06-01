export function normalizeTagName(tagName: string) {
  return tagName.trim().replace(/\s+/g, " ");
}

export function dedupeTagNames(tagNames: string[]) {
  const map = new Map<string, string>();

  for (const tagName of tagNames) {
    const cleaned = normalizeTagName(tagName);
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (!map.has(key)) {
      map.set(key, cleaned);
    }
  }

  return Array.from(map.values());
}

export function areTagNameListsEqual(left: string[], right: string[]) {
  const leftNormalized = dedupeTagNames(left)
    .map((tagName) => tagName.toLowerCase())
    .sort();
  const rightNormalized = dedupeTagNames(right)
    .map((tagName) => tagName.toLowerCase())
    .sort();

  if (leftNormalized.length !== rightNormalized.length) {
    return false;
  }

  return leftNormalized.every((tagName, index) => tagName === rightNormalized[index]);
}
