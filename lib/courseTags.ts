const COURSE_TAG_REGEX = /^(.*?)\s*\[([A-Z]{2,5}\s?\d{3,4}[A-Z]{0,3})\]\s*$/i;

export type CourseTagInfo = {
    code: string;
    title: string;
};

export function normalizeCourseCode(code: string) {
    return code.replace(/\s+/g, "").toUpperCase();
}

export function extractCourseFromTag(tagName: string): CourseTagInfo | null {
    const trimmed = tagName.trim();
    const match = trimmed.match(COURSE_TAG_REGEX);
    if (!match || !match[2]) return null;
    const code = normalizeCourseCode(match[2]);
    const title = match[1]?.trim() || code;
    return { code, title };
}

export function isCourseTag(tagName: string) {
    return Boolean(extractCourseFromTag(tagName));
}
