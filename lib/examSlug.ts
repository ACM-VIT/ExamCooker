import type { ExamType } from "@/prisma/generated/client";

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

export function examTypeToSlug(type: ExamType): string {
    return TYPE_TO_SLUG[type];
}

export function examSlugToType(slug: string): ExamType | null {
    return SLUG_TO_TYPE[slug.toLowerCase()] ?? null;
}

export function examTypeLabel(type: ExamType): string {
    return TYPE_TO_LABEL[type];
}

export const ALL_EXAM_TYPES: ExamType[] = Object.keys(TYPE_TO_SLUG) as ExamType[];
