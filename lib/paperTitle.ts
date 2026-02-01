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
    const baseTitle = rawTitle.replace(/\.pdf$/i, "").replace(/select$/i, "").trim();
    const examType = extractExamType(baseTitle);
    const slot = extractSlot(baseTitle);
    const { academicYear, year } = extractYear(baseTitle);
    const courseCode = extractCourseCode(baseTitle);
    const cleanTitle = stripTrailingMetadataTokens(stripLeadingMetadataTokens(baseTitle));
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
        { regex: /\bfat(?:\s*2)?\b/i, normalize: () => "FAT" },
        { regex: /\bfat2\b/i, normalize: () => "FAT" },
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

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const nextToken = tokens[i + 1];
        const skipPair = shouldSkipMetadataPair(token, nextToken);
        if (!started) {
            if (skipPair || isMetadataToken(token)) {
                if (skipPair) {
                    i += 1;
                }
                continue;
            }
            started = true;
        }
        if (started && (skipPair || isMetadataToken(token))) {
            break;
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
    if (/^cat\d$/.test(normalized)) return true;
    if (/^(fat|fat\d|quiz|mid|midterm|cia)$/.test(normalized)) return true;
    if (/^(qp|paper|select)$/.test(normalized)) return true;
    if (/^[a-g]\d$/i.test(normalized)) return true;
    if (/^\d{2}-\d{2}$/.test(normalized)) return true;
    if (/^20\d{2}-20\d{2}$/.test(normalized)) return true;
    if (/^20\d{2}$/.test(normalized)) return true;
    if (isSlotComboToken(token)) return true;
    return false;
}

function isSlotComboToken(token: string): boolean {
    if (!/[()+]/.test(token) && !/[+]/.test(token)) return false;
    return /[A-G][1-2]/i.test(token);
}

function isMetadataLabel(token: string): boolean {
    const normalized = token.replace(/[^a-z0-9-]/gi, "").toLowerCase();
    return normalized === "slot" || normalized === "year";
}

function isExamLabel(token: string): boolean {
    const normalized = token.replace(/[^a-z0-9-]/gi, "").toLowerCase();
    return (
        normalized === "cat" ||
        normalized === "fat" ||
        normalized === "mid" ||
        normalized === "midterm" ||
        normalized === "quiz" ||
        normalized === "cia"
    );
}

function isExamNumber(token: string): boolean {
    const normalized = token.replace(/[^0-9]/g, "");
    return normalized === "1" || normalized === "2";
}

function shouldSkipMetadataPair(token: string, nextToken?: string): boolean {
    if (!nextToken) return false;
    if (isMetadataLabel(token) && isMetadataToken(nextToken)) return true;
    if (isExamLabel(token) && isExamNumber(nextToken)) return true;
    return false;
}

function stripLeadingMetadataTokens(title: string): string {
    const tokens = title.trim().split(/\s+/);
    let i = 0;
    while (i < tokens.length) {
        const token = tokens[i];
        const nextToken = tokens[i + 1];
        if (shouldSkipMetadataPair(token, nextToken)) {
            i += 2;
            continue;
        }
        if (isMetadataToken(token)) {
            i += 1;
            continue;
        }
        break;
    }
    return tokens.slice(i).join(" ").trim();
}

function stripTrailingMetadataTokens(title: string): string {
    const tokens = title.trim().split(/\s+/);
    let end = tokens.length - 1;
    while (end >= 0) {
        const token = tokens[end];
        const prevToken = tokens[end - 1];
        if (isMetadataToken(token)) {
            end -= 1;
            continue;
        }
        if (prevToken && shouldSkipMetadataPair(prevToken, token)) {
            end -= 2;
            continue;
        }
        break;
    }
    return tokens.slice(0, end + 1).join(" ").trim();
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
