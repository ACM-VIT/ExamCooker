import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma";

function buildWhere(
    search: string,
    tags: string[]
): Prisma.ForumPostWhereInput {
    return {
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
                      { description: { contains: search, mode: "insensitive" } },
                      { author: { name: { contains: search, mode: "insensitive" } } },
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

export async function getForumCount(input: { search: string; tags: string[] }) {
    "use cache";
    cacheTag("forum");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search, input.tags);
    return prisma.forumPost.count({ where });
}

export async function getForumPage(input: {
    search: string;
    tags: string[];
    page: number;
    pageSize: number;
    currentUserId: string | null | undefined;
}) {
    "use cache";
    cacheTag("forum");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search, input.tags);
    const skip = (input.page - 1) * input.pageSize;

    return prisma.forumPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: input.pageSize,
        select: {
            id: true,
            title: true,
            description: true,
            createdAt: true,
            upvoteCount: true,
            downvoteCount: true,
            author: { select: { name: true } },
            tags: true,
            votes: input.currentUserId
                ? {
                      where: { userId: input.currentUserId },
                      select: { type: true },
                  }
                : { select: { type: true }, take: 0 },
            _count: { select: { comments: true } },
        },
    });
}
