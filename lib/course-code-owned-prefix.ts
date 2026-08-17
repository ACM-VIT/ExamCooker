import { normalizeCourseCode } from "@/lib/course-tags";

function normalizedKnownCodes(courseCodes: string[]) {
    return [...new Set(courseCodes.map(normalizeCourseCode).filter(Boolean))].sort(
        (a, b) => b.length - a.length,
    );
}

function findDelimitedOwnerCode(
    name: string,
    courseCodes: string[],
    delimiters: string[],
) {
    const upperName = name.toUpperCase();
    for (const code of normalizedKnownCodes(courseCodes)) {
        if (upperName === code) return code;
        if (delimiters.some((delimiter) => upperName.startsWith(`${code}${delimiter}`))) {
            return code;
        }
    }

    return null;
}

export function replaceOwnedSyllabusCodePrefix(input: {
    name: string;
    currentCode: string;
    nextCode: string;
    knownCourseCodes: string[];
}) {
    const currentCode = normalizeCourseCode(input.currentCode);
    const nextCode = normalizeCourseCode(input.nextCode);
    const ownerCode = findDelimitedOwnerCode(input.name, input.knownCourseCodes, ["_"]);
    if (!currentCode || !nextCode || ownerCode !== currentCode) return null;

    return `${nextCode}${input.name.slice(currentCode.length)}`;
}

export function replaceOwnedSubjectCodePrefix(input: {
    name: string;
    currentCode: string;
    nextCode: string;
    knownCourseCodes: string[];
}) {
    const currentCode = normalizeCourseCode(input.currentCode);
    const nextCode = normalizeCourseCode(input.nextCode);
    const ownerCode = findDelimitedOwnerCode(input.name, input.knownCourseCodes, [
        " -",
        "-",
    ]);
    if (!currentCode || !nextCode || ownerCode !== currentCode) return null;

    return `${nextCode}${input.name.slice(currentCode.length)}`;
}
