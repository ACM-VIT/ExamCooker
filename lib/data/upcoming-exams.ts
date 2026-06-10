import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { and, eq, gte, inArray, isNull, or } from "drizzle-orm";
import {
    course,
    db,
    type ExamType,
    upcomingExam,
} from "@/db";

export type UpcomingExamItem = {
    id: string;
    courseId: string;
    courseCode: string;
    courseTitle: string;
    slots: string[];
    examType: ExamType | null;
    scheduledAt: Date | null;
};

function getUpcomingExamCutoffIso() {
    const bucketMs = 5 * 60 * 1000;
    return new Date(Math.floor(Date.now() / bucketMs) * bucketMs).toISOString();
}

export async function getUpcomingExams(limit?: number): Promise<UpcomingExamItem[]> {
    await connection();
    return getUpcomingExamsCached(limit ?? null, getUpcomingExamCutoffIso());
}

async function getUpcomingExamsCached(
    limit: number | null,
    cutoffIso: string,
): Promise<UpcomingExamItem[]> {
    "use cache";
    cacheTag("upcoming_exams");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const now = new Date(cutoffIso);
    const rows = await db
        .select({
            id: upcomingExam.id,
            courseId: upcomingExam.courseId,
            slots: upcomingExam.slots,
            examType: upcomingExam.examType,
            scheduledAt: upcomingExam.scheduledAt,
            createdAt: upcomingExam.createdAt,
            courseCode: course.code,
            courseTitle: course.title,
        })
        .from(upcomingExam)
        .innerJoin(course, eq(upcomingExam.courseId, course.id))
        .where(
            or(
                isNull(upcomingExam.scheduledAt),
                gte(upcomingExam.scheduledAt, now),
            ),
        );

    return rows
        .sort((a, b) => {
            if (a.scheduledAt === null && b.scheduledAt === null) {
                return b.createdAt.getTime() - a.createdAt.getTime();
            }
            if (a.scheduledAt === null) return 1;
            if (b.scheduledAt === null) return -1;
            return (
                a.scheduledAt.getTime() - b.scheduledAt.getTime() ||
                b.createdAt.getTime() - a.createdAt.getTime()
            );
        })
        .slice(0, limit ?? undefined)
        .map((row) => ({
            id: row.id,
            courseId: row.courseId,
            courseCode: row.courseCode,
            courseTitle: row.courseTitle,
            slots: row.slots ?? [],
            examType: row.examType,
            scheduledAt: row.scheduledAt,
        }));
}

export async function getUpcomingExamsForCourses(
    courseIds: string[],
): Promise<Map<string, UpcomingExamItem[]>> {
    if (courseIds.length === 0) return new Map();
    await connection();
    return getUpcomingExamsForCoursesCached(
        Array.from(new Set(courseIds)).sort(),
        getUpcomingExamCutoffIso(),
    );
}

async function getUpcomingExamsForCoursesCached(
    courseIds: string[],
    cutoffIso: string,
): Promise<Map<string, UpcomingExamItem[]>> {
    "use cache";
    cacheTag("upcoming_exams");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const now = new Date(cutoffIso);
    const rows = await db
        .select({
            id: upcomingExam.id,
            courseId: upcomingExam.courseId,
            slots: upcomingExam.slots,
            examType: upcomingExam.examType,
            scheduledAt: upcomingExam.scheduledAt,
            createdAt: upcomingExam.createdAt,
            courseCode: course.code,
            courseTitle: course.title,
        })
        .from(upcomingExam)
        .innerJoin(course, eq(upcomingExam.courseId, course.id))
        .where(
            and(
                inArray(upcomingExam.courseId, courseIds),
                or(
                    isNull(upcomingExam.scheduledAt),
                    gte(upcomingExam.scheduledAt, now),
                ),
            ),
        );

    const map = new Map<string, UpcomingExamItem[]>();
    const sortedRows = rows.sort((a, b) => {
        if (a.scheduledAt === null && b.scheduledAt === null) {
            return b.createdAt.getTime() - a.createdAt.getTime();
        }
        if (a.scheduledAt === null) return 1;
        if (b.scheduledAt === null) return -1;
        return (
            a.scheduledAt.getTime() - b.scheduledAt.getTime() ||
            b.createdAt.getTime() - a.createdAt.getTime()
        );
    });

    for (const r of sortedRows) {
        const item: UpcomingExamItem = {
            id: r.id,
            courseId: r.courseId,
            courseCode: r.courseCode,
            courseTitle: r.courseTitle,
            slots: r.slots ?? [],
            examType: r.examType,
            scheduledAt: r.scheduledAt,
        };
        const existing = map.get(r.courseId) ?? [];
        existing.push(item);
        map.set(r.courseId, existing);
    }
    return map;
}

export async function listUpcomingExamsForMod(): Promise<UpcomingExamItem[]> {
    const rows = await db
        .select({
            id: upcomingExam.id,
            courseId: upcomingExam.courseId,
            slots: upcomingExam.slots,
            examType: upcomingExam.examType,
            scheduledAt: upcomingExam.scheduledAt,
            createdAt: upcomingExam.createdAt,
            courseCode: course.code,
            courseTitle: course.title,
        })
        .from(upcomingExam)
        .innerJoin(course, eq(upcomingExam.courseId, course.id));

    return rows
        .sort((a, b) => {
            if (a.scheduledAt === null && b.scheduledAt === null) {
                return b.createdAt.getTime() - a.createdAt.getTime();
            }
            if (a.scheduledAt === null) return 1;
            if (b.scheduledAt === null) return -1;
            return (
                a.scheduledAt.getTime() - b.scheduledAt.getTime() ||
                b.createdAt.getTime() - a.createdAt.getTime()
            );
        })
        .map((row) => ({
            id: row.id,
            courseId: row.courseId,
            courseCode: row.courseCode,
            courseTitle: row.courseTitle,
            slots: row.slots ?? [],
            examType: row.examType,
            scheduledAt: row.scheduledAt,
        }));
}
