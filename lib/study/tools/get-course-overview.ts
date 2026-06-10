import { tool } from "ai";
import { z } from "zod";
import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { db, note, pastPaper } from "@/db";
import { getCourseDetailByCode } from "@/lib/data/course-catalog";
import { getSyllabusByCourseCode } from "@/lib/data/syllabus";
import { normalizeCourseCode } from "@/lib/course-tags";
import { examTypeLabel, examTypeToSlug } from "@/lib/exam-slug";
import {
    getCourseNotesPath,
    getCoursePath,
    getCourseSyllabusPath,
    getPastPaperDetailPath,
} from "@/lib/seo";
import type { ScopeContext } from "@/lib/study/scope";

export function createGetCourseOverviewTool(context: ScopeContext | null) {
    return tool({
        description:
            "Get a full ExamCooker overview for a course: course title, available syllabus, counts of past papers by exam type (CAT-1, CAT-2, FAT), and the most recent notes and papers. Use this when the user asks 'what is available for course X' or wants to see everything at once.",
        inputSchema: z.object({
            courseCode: z
                .string()
                .optional()
                .describe("Course code like 'BCSE304L'. Leave blank to use the course already in scope."),
        }),
        execute: async ({ courseCode }) => {
            const code = courseCode
                ? normalizeCourseCode(courseCode)
                : context?.courseCode ?? null;
            if (!code) {
                return { error: "No course code in scope. Ask the user for one." };
            }

            const course = await getCourseDetailByCode(code);
            if (!course) {
                return { error: `No course found for '${code}'.` };
            }

            const [examCounts, syllabus, notes, papers] = await Promise.all([
                db
                    .select({
                        examType: pastPaper.examType,
                        total: count(),
                    })
                    .from(pastPaper)
                    .where(
                        and(
                            eq(pastPaper.courseId, course.id),
                            eq(pastPaper.isClear, true),
                            isNotNull(pastPaper.examType),
                        ),
                    )
                    .groupBy(pastPaper.examType),
                getSyllabusByCourseCode(course.code),
                db
                    .select({ id: note.id, title: note.title })
                    .from(note)
                    .where(and(eq(note.courseId, course.id), eq(note.isClear, true)))
                    .orderBy(desc(note.createdAt))
                    .limit(5),
                db
                    .select({ id: pastPaper.id, title: pastPaper.title })
                    .from(pastPaper)
                    .where(and(eq(pastPaper.courseId, course.id), eq(pastPaper.isClear, true)))
                    .orderBy(desc(pastPaper.createdAt))
                    .limit(5),
            ]);

            return {
                course: {
                    code: course.code,
                    title: course.title,
                    href: getCoursePath(course.code),
                },
                examCounts: examCounts.flatMap((e) =>
                    e.examType
                        ? [{
                            slug: examTypeToSlug(e.examType),
                            label: examTypeLabel(e.examType),
                            count: e.total,
                        }]
                        : [],
                ),
                syllabus: syllabus
                    ? { id: syllabus.id, name: syllabus.name, href: getCourseSyllabusPath(course.code) }
                    : null,
                recentNotes: notes.map((n) => ({
                    id: n.id,
                    title: n.title,
                    href: `/notes/${n.id}`,
                })),
                recentPapers: papers.map((p) => ({
                    id: p.id,
                    title: p.title,
                    href: getPastPaperDetailPath(p.id, course.code),
                })),
                hrefs: {
                    notes: getCourseNotesPath(course.code),
                    papers: getCoursePath(course.code),
                },
            };
        },
    });
}
