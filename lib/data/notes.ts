import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import type { Prisma } from "@/prisma/generated/client";

function buildWhere(search: string, tags: string[]): Prisma.NoteWhereInput {
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

export async function getNotesCount(input: { search: string; tags: string[] }) {
    "use cache";
    cacheTag("notes");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search, input.tags);
    return prisma.note.count({ where });
}

export async function getNotesPage(input: {
    search: string;
    tags: string[];
    page: number;
    pageSize: number;
}) {
    "use cache";
    cacheTag("notes");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search, input.tags);
    const skip = (input.page - 1) * input.pageSize;

    const items = await prisma.note.findMany({
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

function buildCourseWhere(input: {
    courseId?: string | null;
    tagIds: string[];
}): Prisma.NoteWhereInput {
    const or: Prisma.NoteWhereInput[] = [];

    if (input.courseId) {
        or.push({ courseId: input.courseId });
    }

    if (input.tagIds.length > 0) {
        or.push({
            tags: {
                some: {
                    id: {
                        in: input.tagIds,
                    },
                },
            },
        });
    }

    if (or.length === 0) {
        return {
            id: "__missing-course-context__",
        };
    }

    return {
        isClear: true,
        OR: or,
    };
}

export type CourseNoteListItem = {
    id: string;
    title: string;
    thumbNailUrl: string | null;
    updatedAt: Date;
};

export async function getCourseNotesCount(input: {
    courseId?: string | null;
    tagIds: string[];
}) {
    "use cache";
    cacheTag("notes");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildCourseWhere(input);
    return prisma.note.count({ where });
}

export async function getCourseNotesPage(input: {
    courseId?: string | null;
    tagIds: string[];
    page: number;
    pageSize: number;
}): Promise<CourseNoteListItem[]> {
    "use cache";
    cacheTag("notes");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildCourseWhere(input);
    const skip = Math.max(0, (input.page - 1) * input.pageSize);

    const items = await prisma.note.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: input.pageSize,
        select: {
            id: true,
            title: true,
            thumbNailUrl: true,
            updatedAt: true,
        },
    });

    return items.map((item) => ({
        ...item,
        thumbNailUrl: normalizeGcsUrl(item.thumbNailUrl) ?? item.thumbNailUrl,
    }));
}
