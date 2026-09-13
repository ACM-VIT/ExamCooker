type NamedRow = {
  name: string;
};

type PrefixReplacer = (
  name: string,
  currentCode: string,
  nextCode: string,
) => string | null;

function hasPrefixCollision(
  sourceRows: readonly NamedRow[],
  destinationRows: readonly NamedRow[],
  currentCode: string,
  nextCode: string,
  replacePrefix: PrefixReplacer,
) {
  const hasSourceMatch = sourceRows.some(
    (row) => replacePrefix(row.name, currentCode, currentCode) !== null,
  );
  const hasDestinationMatch = destinationRows.some(
    (row) => replacePrefix(row.name, nextCode, nextCode) !== null,
  );

  return hasSourceMatch && hasDestinationMatch;
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
  return hasPrefixCollision(
    sourceRows,
    destinationRows,
    currentCode,
    nextCode,
    replaceSyllabusCodePrefix,
  );
}

export function hasSubjectCodePrefixCollision(
  sourceRows: readonly NamedRow[],
  destinationRows: readonly NamedRow[],
  currentCode: string,
  nextCode: string,
) {
  return hasPrefixCollision(
    sourceRows,
    destinationRows,
    currentCode,
    nextCode,
    replaceSubjectCodePrefix,
  );
}
