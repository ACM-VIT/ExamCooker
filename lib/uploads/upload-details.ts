import {
    campusValues,
    examTypeValues,
    semesterValues,
    type Campus,
    type ExamType,
    type Semester,
} from "@/db/enums";

export type UploadVariant = "Notes" | "Past Papers";

/** The details one uploaded resource is saved with. */
export type UploadResourceMetadata = {
    courseId: string | null;
    examType: ExamType | null;
    slot: string;
    year: string;
    semester: Semester | null;
    campus: Campus | null;
    hasAnswerKey: boolean;
};

export type UploadBatchItem = {
    receiptId: string;
    metadata: UploadResourceMetadata;
};

const examTypes = new Set<string>(examTypeValues);
const semesters = new Set<string>(semesterValues);
const campuses = new Set<string>(campusValues);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function nullableStringValue(value: unknown) {
    return stringValue(value) || null;
}

const emptyMetadata: UploadResourceMetadata = {
    courseId: null,
    examType: null,
    slot: "",
    year: "",
    semester: null,
    campus: null,
    hasAnswerKey: false,
};

function parseDetails(source: Record<string, unknown>, defaults: UploadResourceMetadata) {
    // A field the source leaves out keeps its default; an explicit value
    // (including null or "") replaces it.
    const has = (field: keyof UploadResourceMetadata) => source[field] !== undefined;
    const examType = has("examType") ? nullableStringValue(source.examType) : defaults.examType;
    const semester = has("semester") ? nullableStringValue(source.semester) : defaults.semester;
    const campus = has("campus") ? nullableStringValue(source.campus) : defaults.campus;

    if (examType && !examTypes.has(examType)) return { error: "Exam type is invalid." };
    if (semester && !semesters.has(semester)) return { error: "Semester is invalid." };
    if (campus && !campuses.has(campus)) return { error: "Campus is invalid." };

    const metadata: UploadResourceMetadata = {
        courseId: has("courseId") ? nullableStringValue(source.courseId) : defaults.courseId,
        examType: examType as ExamType | null,
        slot: has("slot") ? stringValue(source.slot) : defaults.slot,
        year: has("year") ? stringValue(source.year) : defaults.year,
        semester: semester as Semester | null,
        campus: campus as Campus | null,
        hasAnswerKey: has("hasAnswerKey") ? source.hasAnswerKey === true : defaults.hasAnswerKey,
    };
    return { metadata };
}

/**
 * Reads the receipts of a save request and the details each resource is
 * saved with: a result's own `details` override the top-level defaults
 * field by field, and every result's values are validated.
 */
export function parseUploadBatch(
    body: Record<string, unknown>,
    variant: UploadVariant,
    maxBatch: number,
): { items: UploadBatchItem[]; error?: undefined } | { error: string; items?: undefined } {
    const results = Array.isArray(body.results) ? body.results : [];
    const receiptIds = results.map((result) =>
        isRecord(result) ? stringValue(result.receiptId) : "",
    );
    if (
        receiptIds.length === 0 ||
        receiptIds.length > maxBatch ||
        receiptIds.some((receiptId) => !receiptId) ||
        new Set(receiptIds).size !== receiptIds.length
    ) {
        return { error: `Upload batches must contain 1-${maxBatch} valid receipts.` };
    }

    const defaults = parseDetails(body, emptyMetadata);
    if (defaults.error !== undefined) return { error: defaults.error };

    const label = variant === "Notes" ? "Note" : "Paper";
    const items: UploadBatchItem[] = [];
    for (const [index, result] of (results as Record<string, unknown>[]).entries()) {
        const details = result.details ?? {};
        if (!isRecord(details)) {
            return { error: `${label} ${index + 1}: details are invalid.` };
        }
        const parsed = parseDetails(details, defaults.metadata);
        if (parsed.error !== undefined) {
            return { error: `${label} ${index + 1}: ${parsed.error}` };
        }
        items.push({ receiptId: receiptIds[index], metadata: parsed.metadata });
    }
    return { items };
}
