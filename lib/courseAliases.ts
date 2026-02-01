import { COURSE_ACRONYMS } from "@/lib/course-map";
import { normalizeCourseCode } from "@/lib/courseTags";

const COURSE_CODE_REGEX = /^[A-Z]{2,5}\s?\d{3,4}[A-Z]{0,3}$/i;

const aliasToCodes = new Map<string, string[]>();

function normalizeAliasKey(input: string) {
    return input
        .trim()
        .replace(/[^a-z0-9]+/gi, " ")
        .replace(/\s+/g, " ")
        .toUpperCase();
}

function addCodes(target: Set<string>, codes: string[]) {
    for (const code of codes) {
        target.add(normalizeCourseCode(code));
    }
}

for (const [alias, codes] of Object.entries(COURSE_ACRONYMS)) {
    const key = normalizeAliasKey(alias);
    if (!key) continue;
    const existing = aliasToCodes.get(key) ?? [];
    const merged = new Set(existing.map((code) => normalizeCourseCode(code)));
    addCodes(merged, codes);
    aliasToCodes.set(key, Array.from(merged));
}

export function getAliasCourseCodes(query: string) {
    const cleaned = normalizeAliasKey(query);
    const matches = new Set<string>();

    if (cleaned) {
        const mapped = aliasToCodes.get(cleaned);
        if (mapped?.length) addCodes(matches, mapped);
    }

    const codeCandidate = normalizeCourseCode(cleaned);
    if (cleaned && COURSE_CODE_REGEX.test(cleaned)) {
        matches.add(codeCandidate);
    }

    return Array.from(matches);
}
