import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { normalizeCourseCode } from "@/lib/courseTags";

function buildWhere(search: string): Prisma.syllabiWhereInput {
    if (!search) return {};
    return {
        name: {
            contains: search,
            mode: "insensitive",
        },
    };
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
