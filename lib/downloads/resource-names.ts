const PDF_EXTENSION = ".pdf";
const ZIP_EXTENSION = ".zip";
const MAX_FILE_NAME_LENGTH = 150;

function stripPdfExtension(value: string) {
    return value.replace(/\.pdf$/i, "").trim();
}

export function sanitizeFileNamePart(value: string | null | undefined) {
    return (value ?? "")
        .replace(/\.pdf$/i, "")
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function compactParts(parts: Array<string | null | undefined>) {
    return parts
        .map((part) => sanitizeFileNamePart(part))
        .filter(Boolean);
}

function withExtension(fileName: string, extension: string) {
    const safeBase =
        sanitizeFileNamePart(fileName)
            .replace(/[. ]+$/g, "")
            .slice(0, MAX_FILE_NAME_LENGTH)
            .trim() || "ExamCooker Download";

    return `${safeBase}${extension}`;
}

export function ensurePdfFileName(fileName: string) {
    return withExtension(fileName, PDF_EXTENSION);
}

export function ensureZipFileName(fileName: string) {
    return withExtension(fileName, ZIP_EXTENSION);
}

export function getFallbackPdfFileName(fileUrl: string) {
    try {
        const { pathname } = new URL(fileUrl);
        const rawName = pathname.split("/").pop();
        if (!rawName) return "ExamCooker Document.pdf";
        return ensurePdfFileName(decodeURIComponent(stripPdfExtension(rawName)));
    } catch {
        return "ExamCooker Document.pdf";
    }
}

export function buildPastPaperPdfFileName(input: {
    courseCode?: string | null;
    courseTitle?: string | null;
    title?: string | null;
    examLabel?: string | null;
    slot?: string | null;
    year?: number | string | null;
    hasAnswerKey?: boolean | null;
}) {
    const paperType = input.hasAnswerKey ? "Answer Key" : "Question Paper";
    const metadata = compactParts([
        input.examLabel,
        input.slot ? `Slot ${input.slot}` : null,
        input.year === null || input.year === undefined ? null : String(input.year),
        paperType,
    ]);
    const fallbackTitle = sanitizeFileNamePart(input.title);
    const parts = compactParts([
        input.courseCode,
        input.courseTitle,
        metadata.length ? metadata.join(" - ") : fallbackTitle || paperType,
    ]);

    return ensurePdfFileName(parts.join(" - "));
}

export function buildPastPaperZipFileName(input: {
    courseCode?: string | null;
    courseTitle?: string | null;
}) {
    return ensureZipFileName(
        compactParts([input.courseCode, input.courseTitle, "Past Papers"]).join(" - "),
    );
}

export function buildNotePdfFileName(input: {
    courseCode?: string | null;
    courseTitle?: string | null;
    title?: string | null;
}) {
    return ensurePdfFileName(
        compactParts([
            input.courseCode,
            input.courseTitle,
            input.title ? `${stripPdfExtension(input.title)} Notes` : "Notes",
        ]).join(" - "),
    );
}

export function buildNotesZipFileName(input: {
    courseCode?: string | null;
    courseTitle?: string | null;
}) {
    return ensureZipFileName(
        compactParts([input.courseCode, input.courseTitle, "Notes"]).join(" - "),
    );
}

export function buildSyllabusPdfFileName(input: {
    courseCode?: string | null;
    courseTitle?: string | null;
    title?: string | null;
}) {
    return ensurePdfFileName(
        compactParts([
            input.courseCode,
            input.courseTitle ?? input.title,
            "Syllabus",
        ]).join(" - "),
    );
}

export function buildSyllabusZipFileName(input?: {
    courseCode?: string | null;
    courseTitle?: string | null;
}) {
    return ensureZipFileName(
        compactParts([
            input?.courseCode,
            input?.courseTitle,
            "Syllabus",
        ]).join(" - ") || "ExamCooker Syllabus",
    );
}

export function dedupeFileNames(fileNames: string[]) {
    const seen = new Map<string, number>();

    return fileNames.map((fileName) => {
        const safeName = ensurePdfFileName(fileName);
        const key = safeName.toLowerCase();
        const count = seen.get(key) ?? 0;
        seen.set(key, count + 1);

        if (count === 0) return safeName;

        return safeName.replace(/\.pdf$/i, ` (${count + 1}).pdf`);
    });
}
