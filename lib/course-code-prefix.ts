import { appendFileSync } from "node:fs";

type NamedRow = {
  name: string;
};

type PrefixReplacer = (name: string, currentCode: string, nextCode: string) => string | null;

function getPrefixCollision(
  sourceRows: readonly NamedRow[],
  destinationRows: readonly NamedRow[],
  currentCode: string,
  nextCode: string,
  replacePrefix: PrefixReplacer,
) {
  const sourceMatchCount = sourceRows.filter(
    (row) => replacePrefix(row.name, currentCode, currentCode) !== null,
  ).length;
  const destinationMatchCount = destinationRows.filter(
    (row) => replacePrefix(row.name, nextCode, nextCode) !== null,
  ).length;

  return {
    sourceMatchCount,
    destinationMatchCount,
    collision: sourceMatchCount > 0 && destinationMatchCount > 0,
  };
}

export function replaceSyllabusCodePrefix(
  name: string,
  currentCode: string,
  nextCode: string,
) {
  const prefix = `${currentCode}_`;
  if (!name.toUpperCase().startsWith(prefix.toUpperCase())) return null;
  return `${nextCode}${name.slice(currentCode.length)}`;
}

export function replaceSubjectCodePrefix(
  name: string,
  currentCode: string,
  nextCode: string,
) {
  const upperName = name.toUpperCase();
  const upperCode = currentCode.toUpperCase();
  if (upperName === upperCode) return nextCode;
  if (!upperName.startsWith(upperCode)) return null;

  const suffix = name.slice(currentCode.length);
  return suffix.startsWith("-") || suffix.startsWith(" -")
    ? `${nextCode}${suffix}`
    : null;
}

export function hasSyllabusCodePrefixCollision(
  sourceRows: readonly NamedRow[],
  destinationRows: readonly NamedRow[],
  currentCode: string,
  nextCode: string,
) {
  const result = getPrefixCollision(
    sourceRows,
    destinationRows,
    currentCode,
    nextCode,
    replaceSyllabusCodePrefix,
  );
  // #region agent log
  appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "H1,H4", location: "lib/course-code-prefix.ts:hasSyllabusCodePrefixCollision", message: "Evaluated exact syllabus prefix collision", data: { currentCode, nextCode, ...result }, timestamp: Date.now() }) + "\n");
  // #endregion
  return result.collision;
}

export function hasSubjectCodePrefixCollision(
  sourceRows: readonly NamedRow[],
  destinationRows: readonly NamedRow[],
  currentCode: string,
  nextCode: string,
) {
  const result = getPrefixCollision(
    sourceRows,
    destinationRows,
    currentCode,
    nextCode,
    replaceSubjectCodePrefix,
  );
  // #region agent log
  appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "H2,H4", location: "lib/course-code-prefix.ts:hasSubjectCodePrefixCollision", message: "Evaluated exact subject prefix collision", data: { currentCode, nextCode, ...result }, timestamp: Date.now() }) + "\n");
  // #endregion
  return result.collision;
}
