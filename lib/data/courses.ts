import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { extractCourseFromTag, normalizeCourseCode } from "@/lib/courseTags";

export type CourseSummary = {
    code: string;
    title: string;
    tagIds: string[];
    usage: number;
    updatedAt: Date | null;
};

function computeUsage(count: { notes: number; pastPapers: number; forumPosts: number }) {
    return count.notes + count.pastPapers + count.forumPosts;
}

async function buildCourseCatalog(minUsage: number) {
    "use cache";
    cacheTag("courses");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const tags = await prisma.tag.findMany({
        select: {
            id: true,
            name: true,
            updatedAt: true,
            _count: {
                select: {
                    notes: true,
                    pastPapers: true,
                    forumPosts: true,
                },
            },
        },
    });

    const map = new Map<string, CourseSummary & { primaryUsage: number }>();

    tags.forEach((tag) => {
        const info = extractCourseFromTag(tag.name);
        if (!info) return;
        const code = normalizeCourseCode(info.code);
        const usage = computeUsage(tag._count);

        const existing = map.get(code);
        if (!existing) {
            map.set(code, {
                code,
                title: info.title,
                tagIds: [tag.id],
                usage,
                updatedAt: tag.updatedAt ?? null,
                primaryUsage: usage,
            });
            return;
        }

        existing.tagIds.push(tag.id);
        existing.usage += usage;
        if (!existing.updatedAt || (tag.updatedAt && tag.updatedAt > existing.updatedAt)) {
            existing.updatedAt = tag.updatedAt;
        }
        if (usage > existing.primaryUsage) {
            existing.title = info.title;
            existing.primaryUsage = usage;
        }
    });

    return Array.from(map.values())
        .map(({ primaryUsage: _primaryUsage, ...course }) => course)
        .filter((course) => course.usage >= minUsage)
        .sort((a, b) => {
            const titleCompare = a.title.localeCompare(b.title, "en", { sensitivity: "base" });
            if (titleCompare !== 0) return titleCompare;
            return a.code.localeCompare(b.code, "en", { sensitivity: "base" });
        });
}

export async function getCourseCatalog(minUsage = 2) {
    return buildCourseCatalog(minUsage);
}

export async function getCourseByCode(code: string, minUsage = 2) {
    const normalized = normalizeCourseCode(code);
    const courses = await buildCourseCatalog(minUsage);
    return courses.find((course) => course.code === normalized) ?? null;
}

export type CourseWithCounts = {
    code: string;
    title: string;
    noteCount: number;
    paperCount: number;
};

export async function getCoursesWithCounts(minUsage = 2): Promise<CourseWithCounts[]> {
    "use cache";
    cacheTag("courses");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const tags = await prisma.tag.findMany({
        select: {
            id: true,
            name: true,
            _count: {
                select: {
                    notes: { where: { isClear: true } },
                    pastPapers: { where: { isClear: true } },
                    forumPosts: true,
                },
            },
        },
    });

    const map = new Map<string, CourseWithCounts & { usage: number; primaryUsage: number }>();

    tags.forEach((tag) => {
        const info = extractCourseFromTag(tag.name);
        if (!info) return;
        const code = normalizeCourseCode(info.code);
        const usage = tag._count.notes + tag._count.pastPapers + tag._count.forumPosts;

        const existing = map.get(code);
        if (!existing) {
            map.set(code, {
                code,
                title: info.title,
                noteCount: tag._count.notes,
                paperCount: tag._count.pastPapers,
                usage,
                primaryUsage: usage,
            });
            return;
        }

        existing.noteCount += tag._count.notes;
        existing.paperCount += tag._count.pastPapers;
        existing.usage += usage;
        if (usage > existing.primaryUsage) {
            existing.title = info.title;
            existing.primaryUsage = usage;
        }
    });

    return Array.from(map.values())
        .filter((course) => course.usage >= minUsage)
        .map(({ usage: _usage, primaryUsage: _primaryUsage, ...course }) => course)
        .sort((a, b) => {
            const titleCompare = a.title.localeCompare(b.title, "en", { sensitivity: "base" });
            if (titleCompare !== 0) return titleCompare;
            return a.code.localeCompare(b.code, "en", { sensitivity: "base" });
        });
}

export async function getCourseByCodeAny(code: string) {
    return getCourseByCode(code, 1);
}
