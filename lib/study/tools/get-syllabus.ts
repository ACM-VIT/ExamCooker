import { tool } from "ai";
import { z } from "zod";
import { getSyllabusByCourseCode, getSyllabusPage } from "@/lib/data/syllabus";
import { normalizeCourseCode } from "@/lib/course-tags";
import { getCourseSyllabusPath } from "@/lib/seo";
import type { ScopeContext } from "@/lib/study/scope";

export function createGetSyllabusTool(context: ScopeContext | null) {
    return tool({
        description:
            "Look up the official VIT syllabus PDF for a course. Returns the syllabus record with a direct link the student can open. Prefer this over guessing syllabus contents.",
        inputSchema: z.object({
            courseCode: z
                .string()
                .optional()
                .describe("Course code like 'BCSE304L'. Leave blank to use the course in scope."),
            query: z
                .string()
                .optional()
                .describe("Free-text fallback when no exact course match is known."),
        }),
        execute: async ({ courseCode, query }) => {
            const code = courseCode
                ? normalizeCourseCode(courseCode)
                : context?.courseCode ?? null;

            if (code) {
                const syllabus = await getSyllabusByCourseCode(code);
                if (syllabus) {
                    return {
                        match: "exact" as const,
                        syllabus: {
                            id: syllabus.id,
                            name: syllabus.name,
                            href: getCourseSyllabusPath(code),
                        },
                    };
                }
            }

            // Fallback to name-based search.
            const items = await getSyllabusPage({
                search: query ?? code ?? "",
                page: 1,
                pageSize: 5,
            });

            return {
                match: "search" as const,
                items: items.map((s) => ({
                    id: s.id,
                    name: s.name,
                    href: `/syllabus/${s.id}`,
                })),
            };
        },
    });
}
