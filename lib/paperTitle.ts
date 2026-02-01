export type ParsedPaperTitle = {
    cleanTitle: string;
    examType?: string;
    slot?: string;
    year?: string;
    academicYear?: string;
    courseCode?: string;
    courseName?: string;
};

const SLOT_REGEX = /\b([A-G][1-2])\b/i;
const YEAR_RANGE_REGEX = /\b((?:20)?\d{2})\s*-\s*((?:20)?\d{2})\b/;
const YEAR_REGEX = /\b(20\d{2})\b/;
const COURSE_CODE_REGEX = /([A-Z]{2,5}\d{3,4}[A-Z]{0,3})/g;

export function parsePaperTitle(rawTitle: string): ParsedPaperTitle {
    const cleanTitle = rawTitle.replace(/\.pdf$/i, "").replace(/select$/i, "").trim();
    const examType = extractExamType(cleanTitle);
    const slot = extractSlot(cleanTitle);
    const { academicYear, year } = extractYear(cleanTitle);
    const courseCode = extractCourseCode(cleanTitle);
    const courseName = extractCourseName(cleanTitle, courseCode);

    return {
        cleanTitle,
        examType,
        slot,
        year,
        academicYear,
        courseCode,
        courseName,
    };
}

export function extractExamType(title: string): string | undefined {
    const patterns: { regex: RegExp; normalize: () => string }[] = [
        { regex: /\bcat[-\s]?1\b/i, normalize: () => "CAT-1" },
        { regex: /\bcat[-\s]?2\b/i, normalize: () => "CAT-2" },
        { regex: /\bfat\b/i, normalize: () => "FAT" },
        { regex: /\bmid(?:term)?\b/i, normalize: () => "MID" },
        { regex: /\bquiz\b/i, normalize: () => "Quiz" },
        { regex: /\bcia\b/i, normalize: () => "CIA" },
    ];

    for (const { regex, normalize } of patterns) {
        if (regex.test(title)) {
            return normalize();
        }
    }
    return undefined;
}

export function extractSlot(title: string): string | undefined {
    const match = title.match(SLOT_REGEX);
    return match ? match[1].toUpperCase() : undefined;
}

export function extractYear(title: string): { academicYear?: string; year?: string } {
    const rangeMatch = title.match(YEAR_RANGE_REGEX);
    if (rangeMatch) {
        const start = normalizeYear(rangeMatch[1]);
        const end = normalizeYear(rangeMatch[2]);
        if (start && end) {
            return {
                academicYear: `${start}-${end}`,
                year: start,
            };
        }
    }

    const singleMatch = title.match(YEAR_REGEX);
    if (singleMatch) {
        const normalized = normalizeYear(singleMatch[1]);
        return { year: normalized, academicYear: normalized };
    }

    return {};
}

export function extractCourseCode(title: string): string | undefined {
    let courseCode: string | undefined;
    let match: RegExpExecArray | null;
    while ((match = COURSE_CODE_REGEX.exec(title.toUpperCase())) !== null) {
        courseCode = match[1].toUpperCase();
    }
    COURSE_CODE_REGEX.lastIndex = 0;
    return courseCode;
}

export function extractCourseName(title: string, courseCode?: string): string | undefined {
    let working = title;
    if (courseCode) {
        const idx = working.toUpperCase().lastIndexOf(courseCode);
        if (idx > -1) {
            working = working.slice(0, idx);
        }
    }

    working = working.replace(/\[[A-Z]{2,5}\s?\d{3,4}[A-Z]{0,3}\]\s*/gi, "");
    working = working.replace(/[\[\]]\s*$/, "");
    working = working.replace(/[-–—]\s*$/, "").trim();

    const tokens = working.split(/\s+/);
    const resultTokens: string[] = [];
    let started = false;

    for (const token of tokens) {
        if (!started) {
            if (isMetadataToken(token)) {
                continue;
            }
            started = true;
        }
        resultTokens.push(token);
    }

    const name = resultTokens.join(" ").trim();
    return name || undefined;
}

function isMetadataToken(token: string): boolean {
    const normalized = token.replace(/[^a-z0-9-]/gi, "").toLowerCase();
    if (!normalized) return true;
    if (/^cat-?\d$/.test(normalized)) return true;
    if (/^(fat|quiz|mid|cia)$/.test(normalized)) return true;
    if (/^(qp|paper|select)$/.test(normalized)) return true;
    if (/^[a-g]\d$/i.test(normalized)) return true;
    if (/^\d{2}-\d{2}$/.test(normalized)) return true;
    if (/^20\d{2}-20\d{2}$/.test(normalized)) return true;
    if (/^20\d{2}$/.test(normalized)) return true;
    return false;
}

function normalizeYear(value?: string): string | undefined {
    if (!value) return undefined;
    const digits = value.replace(/\D/g, "");
    if (digits.length === 4) return digits;
    if (digits.length === 2) {
        const parsed = parseInt(digits, 10);
        if (!Number.isNaN(parsed)) {
            return (2000 + parsed).toString();
        }
    }
    return undefined;
}
