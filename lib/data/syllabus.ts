import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma";

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
