import { tool } from "ai";
import { z } from "zod";
import { getNotesPage } from "@/lib/data/notes";
import { normalizeCourseCode } from "@/lib/course-tags";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import type { ScopeContext } from "@/lib/study/scope";

export function createSearchNotesTool(context: ScopeContext | null) {
    return tool({
        description:
            "Search ExamCooker's notes library. Use when the user asks for study notes, lecture notes, or reading material on a topic or course. Returns up to 8 matches with direct links.",
        inputSchema: z.object({
            query: z
                .string()
                .optional()
                .describe("Free-text search over note titles and tags."),
            courseCode: z
                .string()
                .optional()
                .describe(
                    "Course code like 'BCSE304L'. If the active scope has a course code and the user doesn't mention another, leave blank."
                ),
            limit: z.number().int().min(1).max(8).default(6),
        }),
        execute: async ({ query, courseCode, limit }) => {
            const normalizedCourse = courseCode
                ? normalizeCourseCode(courseCode)
                : context?.courseCode ?? null;
            const searchParts = [query, normalizedCourse].filter(Boolean) as string[];
            const search = searchParts.join(" ").trim();

            const items = await getNotesPage({
                search,
                tags: [],
                page: 1,
                pageSize: limit,
            });

            return {
                query: search || null,
                filters: { courseCode: normalizedCourse },
                items: items.map((n) => ({
                    id: n.id,
                    title: n.title,
                    href: `/notes/${n.id}`,
                    thumbnail: normalizeGcsUrl(n.thumbNailUrl) ?? n.thumbNailUrl ?? null,
                    type: "note" as const,
                })),
                total: items.length,
            };
        },
    });
}
