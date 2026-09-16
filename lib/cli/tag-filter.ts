export function normalizeTagFilterNames(
  values: readonly string[] | null | undefined,
): string[] {
  return [
    ...new Set(
      (values ?? [])
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function matchesLiteralTagName(tagName: string, requestedName: string): boolean {
  return tagName.toLowerCase() === requestedName.toLowerCase();
}
