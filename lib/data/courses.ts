import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizeCourseCode } from "@/lib/courseTags";

export type CourseSummary = {
    code: string;
    title: string;
    noteCount: number;
    paperCount: number;
};

export async function getCourseByCodeAny(code: string): Promise<CourseSummary | null> {
    "use cache";
    cacheTag("courses");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const normalized = normalizeCourseCode(code.trim());
    const course = await prisma.course.findFirst({
        where: {
            OR: [
                { code: normalized },
                { aliases: { has: normalized } },
            ],
        },
        select: {
            code: true,
            title: true,
            _count: {
                select: {
                    notes: { where: { isClear: true } },
                    papers: { where: { isClear: true } },
                },
            },
        },
    });

    if (!course) return null;

    return {
        code: course.code,
        title: course.title,
        noteCount: course._count.notes,
        paperCount: course._count.papers,
    };
}
