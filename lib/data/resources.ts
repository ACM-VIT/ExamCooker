import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma";

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
