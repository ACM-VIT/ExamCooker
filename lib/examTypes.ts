import type { Prisma } from "@/src/generated/prisma";

export type ExamTypeDef = {
    slug: string;
    label: string;
    regex: RegExp;
    searchTokens: string[];
    keywords: string[];
};

export const EXAM_TYPES: ExamTypeDef[] = [
    {
        slug: "cat-1",
        label: "CAT-1",
        regex: /\bcat[-\s]?1\b/i,
        searchTokens: ["cat1", "cat 1", "cat-1"],
        keywords: ["cat-1", "cat 1", "cat1", "cat 1 exam", "cat-1 question paper"],
    },
    {
        slug: "cat-2",
        label: "CAT-2",
        regex: /\bcat[-\s]?2\b/i,
        searchTokens: ["cat2", "cat 2", "cat-2"],
        keywords: ["cat-2", "cat 2", "cat2", "cat 2 exam", "cat-2 question paper"],
    },
    {
        slug: "fat",
        label: "FAT",
        regex: /\bfat\b/i,
        searchTokens: ["fat"],
        keywords: ["fat", "fat exam", "fat question paper", "final assessment test"],
    },
];

export function getExamTypeBySlug(slug: string) {
    return EXAM_TYPES.find((type) => type.slug === slug);
}

export function matchExamTypeFromTitle(title: string) {
    return EXAM_TYPES.find((type) => type.regex.test(title)) ?? null;
}

export function buildExamTitleWhere(examType: ExamTypeDef): Prisma.PastPaperWhereInput {
    if (!examType.searchTokens.length) return {};
    return {
        OR: examType.searchTokens.map((token) => ({
            title: {
                contains: token,
                mode: "insensitive",
            },
        })),
    };
}
