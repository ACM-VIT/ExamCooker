import { cacheLife, cacheTag } from "next/cache";
import { and, count, eq, or, sql } from "drizzle-orm";
import { normalizeCourseCode } from "@/lib/courseTags";
import { course, db, note, pastPaper } from "@/db";

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
    const rows = await db
        .select({
            id: course.id,
            code: course.code,
            title: course.title,
        })
        .from(course)
        .where(
            or(
                eq(course.code, normalized),
                sql`${normalized} = any(${course.aliases})`,
            ),
        )
        .limit(1);

    const courseRow = rows[0];

    if (!courseRow) return null;

    const [noteRows, paperRows] = await Promise.all([
        db
            .select({ total: count() })
            .from(note)
            .where(and(eq(note.courseId, courseRow.id), eq(note.isClear, true))),
        db
            .select({ total: count() })
            .from(pastPaper)
            .where(and(eq(pastPaper.courseId, courseRow.id), eq(pastPaper.isClear, true))),
    ]);

    return {
        code: courseRow.code,
        title: courseRow.title,
        noteCount: noteRows[0]?.total ?? 0,
        paperCount: paperRows[0]?.total ?? 0,
    };
}
