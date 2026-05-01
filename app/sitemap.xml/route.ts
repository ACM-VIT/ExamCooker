import { NextResponse } from "next/server";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { getBaseUrl } from "@/lib/seo";
import { getCourseGrid, getCourseSearchRecords } from "@/lib/data/course-catalog";
import { getCourseExamCombos } from "@/lib/data/course-exams";
import { getExamHubSummaries } from "@/lib/data/course-exams";
import { db, note, pastPaper, subject, syllabi } from "@/db";

const PAGE_SIZE = 40000;

function buildSitemapIndexXml(entries: string[]) {
    const body = entries
        .map((loc) => `  <sitemap><loc>${loc}</loc></sitemap>`)
        .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`;
}

export async function GET() {
    const baseUrl = getBaseUrl();
    const [
        noteCount,
        pastPaperCount,
        resourceCount,
        syllabusCount,
        courses,
        courseExamCombos,
        courseNoteRoutes,
        examHubs,
    ] =
        await Promise.all([
            db
                .select({ total: count() })
                .from(note)
                .where(eq(note.isClear, true))
                .then((rows) => rows[0]?.total ?? 0),
            db
                .select({ total: count() })
                .from(pastPaper)
                .where(eq(pastPaper.isClear, true))
                .then((rows) => rows[0]?.total ?? 0),
            db
                .select({ total: count() })
                .from(subject)
                .then((rows) => rows[0]?.total ?? 0),
            db
                .select({ total: count() })
                .from(syllabi)
                .then((rows) => rows[0]?.total ?? 0),
            getCourseGrid(),
            getCourseExamCombos(),
            getCourseSearchRecords(),
            getExamHubSummaries(),
        ]);

    const courseCount = courses.length;
    const courseExamCount = courseExamCombos.length;
    const courseNoteCount = courseNoteRoutes.filter((course) => course.noteCount > 0).length;
    const examHubCount = examHubs.length;

    const entries: string[] = [];

    entries.push(`${baseUrl}/sitemaps/static.xml`);

    const collections = [
        { key: "notes", count: noteCount },
        { key: "past-papers", count: pastPaperCount },
        { key: "courses", count: courseCount },
        { key: "course-exams", count: courseExamCount },
        { key: "course-notes", count: courseNoteCount },
        { key: "resources", count: resourceCount },
        { key: "syllabus", count: syllabusCount },
        { key: "exam-hubs", count: examHubCount },
    ];

    collections.forEach(({ key, count }) => {
        if (!count) return;
        const pages = Math.ceil(count / PAGE_SIZE);
        for (let page = 1; page <= pages; page += 1) {
            const pageSuffix = pages > 1 ? `?page=${page}` : "";
            entries.push(`${baseUrl}/sitemaps/${key}.xml${pageSuffix}`);
        }
    });

    const xml = buildSitemapIndexXml(entries);
    return new NextResponse(xml, {
        headers: {
            "Content-Type": "application/xml",
        },
    });
}
