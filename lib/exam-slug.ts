import type { ExamType } from "@/db";

const TYPE_TO_SLUG: Record<ExamType, string> = {
    CAT_1: "cat-1",
    CAT_2: "cat-2",
    FAT: "fat",
    MODEL_CAT_1: "model-cat-1",
    MODEL_CAT_2: "model-cat-2",
    MODEL_FAT: "model-fat",
    MID: "mid",
    QUIZ: "quiz",
    CIA: "cia",
    OTHER: "other",
};

const TYPE_TO_LABEL: Record<ExamType, string> = {
    CAT_1: "CAT-1",
    CAT_2: "CAT-2",
    FAT: "FAT",
    MODEL_CAT_1: "Model CAT-1",
    MODEL_CAT_2: "Model CAT-2",
    MODEL_FAT: "Model FAT",
    MID: "Mid",
    QUIZ: "Quiz",
    CIA: "CIA",
    OTHER: "Other",
};

const SLUG_TO_TYPE: Record<string, ExamType> = Object.fromEntries(
    Object.entries(TYPE_TO_SLUG).map(([k, v]) => [v, k as ExamType]),
);

const INPUT_TO_TYPE: Record<string, ExamType> = {
    cat1: "CAT_1",
    "cat 1": "CAT_1",
    "cat i": "CAT_1",
    "cat one": "CAT_1",
    cat2: "CAT_2",
    "cat 2": "CAT_2",
    "cat ii": "CAT_2",
    "cat two": "CAT_2",
    fat: "FAT",
    final: "FAT",
    "final assessment": "FAT",
    "final assessment test": "FAT",
    "end sem": "FAT",
    "end semester": "FAT",
    endsem: "FAT",
    "model cat1": "MODEL_CAT_1",
    "model cat 1": "MODEL_CAT_1",
    "model cat i": "MODEL_CAT_1",
    "model cat one": "MODEL_CAT_1",
    "sample cat1": "MODEL_CAT_1",
    "sample cat 1": "MODEL_CAT_1",
    "model cat2": "MODEL_CAT_2",
    "model cat 2": "MODEL_CAT_2",
    "model cat ii": "MODEL_CAT_2",
    "model cat two": "MODEL_CAT_2",
    "sample cat2": "MODEL_CAT_2",
    "sample cat 2": "MODEL_CAT_2",
    "model final": "MODEL_FAT",
    "model fat": "MODEL_FAT",
    "sample final": "MODEL_FAT",
    "sample fat": "MODEL_FAT",
    mid: "MID",
    "mid sem": "MID",
    "mid semester": "MID",
    midsem: "MID",
    midterm: "MID",
    "mid term": "MID",
    quizzes: "QUIZ",
    "continuous internal": "CIA",
    "continuous internal assessment": "CIA",
};

function normalizeExamTypeInput(value: string) {
    return value
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function examTypeToSlug(type: ExamType): string {
    return TYPE_TO_SLUG[type];
}

export function examSlugToType(slug: string): ExamType | null {
    return SLUG_TO_TYPE[slug.toLowerCase()] ?? null;
}

export function parseExamTypeInput(value: string | null | undefined): ExamType | null {
    const normalized = normalizeExamTypeInput(value ?? "");
    if (!normalized) return null;

    const enumKey = normalized.replace(/\s+/g, "_").toUpperCase();
    if (enumKey in TYPE_TO_SLUG) {
        return enumKey as ExamType;
    }

    return INPUT_TO_TYPE[normalized] ?? INPUT_TO_TYPE[normalized.replace(/\s+/g, "")] ?? null;
}

export function examTypeLabel(type: ExamType): string {
    return TYPE_TO_LABEL[type];
}

export const ALL_EXAM_TYPES: ExamType[] = Object.keys(TYPE_TO_SLUG) as ExamType[];
