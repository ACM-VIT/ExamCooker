import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/prisma/generated/client";
import { normalizeCourseCode } from "@/lib/courseTags";

function buildWhere(search: string): Prisma.SubjectWhereInput {
    if (!search) return {};
    return {
        name: {
            contains: search,
            mode: "insensitive",
        },
    };
}

export async function getResourcesCount(input: { search: string }) {
    "use cache";
    cacheTag("resources");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search);
    return prisma.subject.count({ where });
}

export async function getResourcesPage(input: {
    search: string;
    page: number;
    pageSize: number;
}) {
    "use cache";
    cacheTag("resources");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search);
    const skip = (input.page - 1) * input.pageSize;

    return prisma.subject.findMany({
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

export async function getSubjectByCourseCode(code: string) {
    "use cache";
    cacheTag("resources");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const normalized = normalizeCourseCode(code);
    if (!normalized) return null;

    return prisma.subject.findFirst({
        where: {
            OR: [
                {
                    name: {
                        startsWith: `${normalized} -`,
                        mode: "insensitive",
                    },
                },
                {
                    name: {
                        startsWith: `${normalized}-`,
                        mode: "insensitive",
                    },
                },
                {
                    name: {
                        equals: normalized,
                        mode: "insensitive",
                    },
                },
            ],
        },
        include: {
            modules: true,
        },
        orderBy: {
            name: "asc",
        },
    });
}
