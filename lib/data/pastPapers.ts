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
