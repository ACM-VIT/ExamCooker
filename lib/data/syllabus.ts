import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/prisma/generated/client";
import { normalizeCourseCode } from "@/lib/courseTags";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";

function buildSearchTerms(search: string) {
    const rawSearch = search.trim().replace(/\s+/g, " ");
    if (!rawSearch) return [];

    const compactCourseCode = normalizeCourseCode(rawSearch);
    const terms = new Set<string>([
        rawSearch,
        rawSearch.replace(/\s+/g, "_"),
    ]);

    if (compactCourseCode) {
        terms.add(compactCourseCode);
    }

    return Array.from(terms);
}

function buildWhere(search: string): Prisma.syllabiWhereInput {
    const terms = buildSearchTerms(search);
    if (!terms.length) return {};

    return {
        OR: terms.map((term) => ({
            name: {
                contains: term,
                mode: "insensitive",
            },
        })),
    };
}

export async function getAllSyllabi() {
    "use cache";
    cacheTag("syllabus");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const syllabi = await prisma.syllabi.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, fileUrl: true },
    });

    return syllabi.map((syllabus) => ({
        ...syllabus,
        fileUrl: normalizeGcsUrl(syllabus.fileUrl) ?? syllabus.fileUrl,
    }));
}

export async function getSyllabusCount(input: { search: string }) {
    "use cache";
    cacheTag("syllabus");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search);
    return prisma.syllabi.count({ where });
}

export async function getSyllabusPage(input: {
    search: string;
    page: number;
    pageSize: number;
}) {
    "use cache";
    cacheTag("syllabus");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search);
    const skip = (input.page - 1) * input.pageSize;

    return prisma.syllabi.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: input.pageSize,
        select: {
            id: true,
            name: true,
        },
    });
}

export async function getSyllabusByCourseCode(code: string) {
    "use cache";
    cacheTag("syllabus");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const normalized = normalizeCourseCode(code);
    if (!normalized) return null;

    return prisma.syllabi.findFirst({
        where: {
            name: {
                startsWith: `${normalized}_`,
                mode: "insensitive",
            },
        },
        select: {
            id: true,
            name: true,
        },
        orderBy: { name: "asc" },
    });
}

export async function getSyllabusDetailByCourseCode(code: string) {
    "use cache";
    cacheTag("syllabus");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const normalized = normalizeCourseCode(code);
    if (!normalized) return null;

    const syllabus = await prisma.syllabi.findFirst({
        where: {
            name: {
                startsWith: `${normalized}_`,
                mode: "insensitive",
            },
        },
        select: {
            id: true,
            name: true,
            fileUrl: true,
        },
        orderBy: { name: "asc" },
    });

    if (!syllabus) return null;

    return {
        ...syllabus,
        fileUrl: normalizeGcsUrl(syllabus.fileUrl) ?? syllabus.fileUrl,
    };
}
