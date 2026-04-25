import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getBaseUrl } from "@/lib/seo";
import { getCourseGrid, getSearchableCourses } from "@/lib/data/courseCatalog";
import { getCourseExamCombos } from "@/lib/data/courseExams";
import { getExamHubSummaries } from "@/lib/data/courseExams";

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
            prisma.note.count({ where: { isClear: true } }),
            prisma.pastPaper.count({ where: { isClear: true } }),
            prisma.subject.count(),
            prisma.syllabi.count(),
            getCourseGrid(),
            getCourseExamCombos(),
            getSearchableCourses(),
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
