import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { Prisma } from "@/src/generated/prisma";

function buildWhere(
    search: string,
    tags: string[]
): Prisma.PastPaperWhereInput {
    return {
        isClear: true,
        ...(tags.length > 0
            ? {
                  tags: {
                      some: {
                          name: {
                              in: tags,
                          },
                      },
                  },
              }
            : {}),
        ...(search
            ? {
                  OR: [
                      { title: { contains: search, mode: "insensitive" } },
                      {
                          tags: {
                              some: {
                                  name: {
                                      contains: search,
                                      mode: "insensitive",
                                  },
                              },
                          },
                      },
                  ],
              }
            : {}),
    };
}

export async function getPastPapersCount(input: {
    search: string;
    tags: string[];
}) {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search, input.tags);
    return prisma.pastPaper.count({ where });
}

export async function getPastPapersPage(input: {
    search: string;
    tags: string[];
    page: number;
    pageSize: number;
}) {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search, input.tags);
    const skip = (input.page - 1) * input.pageSize;

    const items = await prisma.pastPaper.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: input.pageSize,
        select: {
            id: true,
            title: true,
            thumbNailUrl: true,
        },
    });

    return items.map((item) => ({
        ...item,
        thumbNailUrl: normalizeGcsUrl(item.thumbNailUrl),
    }));
}

export async function getRelatedPastPapers(input: {
    id: string;
    tagIds: string[];
    examType?: string;
    limit?: number;
}) {
    "use cache";
    cacheTag("past_papers");
    cacheTag(`past_paper:${input.id}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    if (!input.tagIds.length) return [];

    const candidates = await prisma.pastPaper.findMany({
        where: {
            isClear: true,
            id: { not: input.id },
            tags: { some: { id: { in: input.tagIds } } },
        },
        orderBy: { updatedAt: "desc" },
        take: Math.max(30, input.limit ?? 0),
        select: {
            id: true,
            title: true,
            thumbNailUrl: true,
            updatedAt: true,
            tags: { select: { id: true } },
        },
    });

    const tagIdSet = new Set(input.tagIds);
    const scored = candidates.map((paper) => {
        let score = paper.tags.reduce(
            (acc, tag) => acc + (tagIdSet.has(tag.id) ? 1 : 0),
            0
        );
        // Boost score significantly if exam type matches
        if (input.examType) {
            const examTypeRegex = new RegExp(`\\b${input.examType.replace(/[-\s]/g, "[-\\s]?")}\\b`, "i");
            if (examTypeRegex.test(paper.title)) {
                score += 1000; // Large boost to prioritize matching exam types
            }
        }
        return { ...paper, score };
    });

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    return scored.slice(0, input.limit ?? 6).map((paper) => ({
        id: paper.id,
        title: paper.title,
        thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? paper.thumbNailUrl,
    }));
}

export async function getRelatedPastPapersByCourseCode(input: {
    id: string;
    courseCode: string;
    examType?: string;
    limit?: number;
}) {
    "use cache";
    cacheTag("past_papers");
    cacheTag(`past_paper:${input.id}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const code = input.courseCode.trim();
    if (!code) return [];

    const candidates = await prisma.pastPaper.findMany({
        where: {
            isClear: true,
            id: { not: input.id },
            OR: [
                { title: { contains: code, mode: "insensitive" } },
                { tags: { some: { name: { contains: code, mode: "insensitive" } } } },
            ],
        },
        orderBy: { updatedAt: "desc" },
        take: Math.max(30, input.limit ?? 0),
        select: {
            id: true,
            title: true,
            thumbNailUrl: true,
            updatedAt: true,
        },
    });

    const scored = candidates.map((paper) => {
        let score = 0;
        if (input.examType) {
            const examTypeRegex = new RegExp(`\\b${input.examType.replace(/[-\s]/g, "[-\\s]?")}\\b`, "i");
            if (examTypeRegex.test(paper.title)) {
                score += 1000;
            }
        }
        return { ...paper, score };
    });

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    return scored.slice(0, input.limit ?? 6).map((paper) => ({
        id: paper.id,
        title: paper.title,
        thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? paper.thumbNailUrl,
    }));
}
