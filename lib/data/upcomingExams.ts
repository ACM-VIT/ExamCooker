import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import prisma from "@/lib/prisma";
import type { ExamType } from "@/prisma/generated/client";

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
    const rows = await prisma.upcomingExam.findMany({
        where: {
            OR: [
                { scheduledAt: null },
                { scheduledAt: { gte: now } },
            ],
        },
        orderBy: [
            { scheduledAt: { sort: "asc", nulls: "last" } },
            { createdAt: "desc" },
        ],
        take: limit ?? undefined,
        select: {
            id: true,
            courseId: true,
            slots: true,
            examType: true,
            scheduledAt: true,
            course: {
                select: {
                    code: true,
                    title: true,
                },
            },
        },
    });

    return rows.map((r) => ({
        id: r.id,
        courseId: r.courseId,
        courseCode: r.course.code,
        courseTitle: r.course.title,
        slots: r.slots,
        examType: r.examType,
        scheduledAt: r.scheduledAt,
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
    const rows = await prisma.upcomingExam.findMany({
        where: {
            courseId: { in: courseIds },
            OR: [
                { scheduledAt: null },
                { scheduledAt: { gte: now } },
            ],
        },
        select: {
            id: true,
            courseId: true,
            slots: true,
            examType: true,
            scheduledAt: true,
            course: { select: { code: true, title: true } },
        },
    });

    const map = new Map<string, UpcomingExamItem[]>();
    for (const r of rows) {
        const item: UpcomingExamItem = {
            id: r.id,
            courseId: r.courseId,
            courseCode: r.course.code,
            courseTitle: r.course.title,
            slots: r.slots,
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
    const rows = await prisma.upcomingExam.findMany({
        orderBy: [
            { scheduledAt: { sort: "asc", nulls: "last" } },
            { createdAt: "desc" },
        ],
        select: {
            id: true,
            courseId: true,
            slots: true,
            examType: true,
            scheduledAt: true,
            course: { select: { code: true, title: true } },
        },
    });
    return rows.map((r) => ({
        id: r.id,
        courseId: r.courseId,
        courseCode: r.course.code,
        courseTitle: r.course.title,
        slots: r.slots,
        examType: r.examType,
        scheduledAt: r.scheduledAt,
    }));
}
