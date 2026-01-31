import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getBaseUrl, safeEncodeURIComponent } from "@/lib/seo";
import { getCourseCatalog } from "@/lib/data/courses";
import { getCourseExamCombos } from "@/lib/data/courseExams";

const PAGE_SIZE = 40000;

type UrlEntry = {
    loc: string;
    lastmod?: string;
};

function buildUrlSetXml(entries: UrlEntry[]) {
    const body = entries
        .map((entry) => {
            const lastmod = entry.lastmod
                ? `<lastmod>${entry.lastmod}</lastmod>`
                : "";
            return `  <url><loc>${entry.loc}</loc>${lastmod}</url>`;
        })
        .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

function parseCollection(raw: string) {
    return raw.replace(/\.xml$/i, "");
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ collection: string }> }
) {
    const { collection } = await params;
    const collectionName = parseCollection(collection);
    const pageParam = req.nextUrl.searchParams.get("page") || "1";
    const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);
    const skip = (page - 1) * PAGE_SIZE;

    const baseUrl = getBaseUrl();

    let entries: UrlEntry[] = [];

    if (collectionName === "static") {
        entries = [
            { loc: `${baseUrl}/` },
            { loc: `${baseUrl}/notes` },
            { loc: `${baseUrl}/past_papers` },
            { loc: `${baseUrl}/courses` },
            { loc: `${baseUrl}/resources` },
            { loc: `${baseUrl}/syllabus` },
        ];
    } else if (collectionName === "notes") {
        const notes = await prisma.note.findMany({
            where: { isClear: true },
            orderBy: { updatedAt: "desc" },
            skip,
            take: PAGE_SIZE,
            select: { id: true, updatedAt: true },
        });
        entries = notes.map((note) => ({
            loc: `${baseUrl}/notes/${note.id}`,
            lastmod: note.updatedAt.toISOString(),
        }));
    } else if (collectionName === "past-papers") {
        const papers = await prisma.pastPaper.findMany({
            where: { isClear: true },
            orderBy: { updatedAt: "desc" },
            skip,
            take: PAGE_SIZE,
            select: { id: true, updatedAt: true },
        });
        entries = papers.map((paper) => ({
            loc: `${baseUrl}/past_papers/${paper.id}`,
            lastmod: paper.updatedAt.toISOString(),
        }));
    } else if (collectionName === "courses") {
        const courses = await getCourseCatalog(2);
        const pageItems = courses.slice(skip, skip + PAGE_SIZE);
        entries = pageItems.map((course) => ({
            loc: `${baseUrl}/courses/${safeEncodeURIComponent(course.code)}`,
        }));
    } else if (collectionName === "course-exams") {
        const combos = await getCourseExamCombos();
        const pageItems = combos.slice(skip, skip + PAGE_SIZE);
        entries = pageItems.map((combo) => ({
            loc: `${baseUrl}/courses/${safeEncodeURIComponent(combo.code)}/${combo.examSlug}`,
        }));
    } else if (collectionName === "resources") {
        const subjects = await prisma.subject.findMany({
            orderBy: { name: "asc" },
            skip,
            take: PAGE_SIZE,
            select: { id: true },
        });
        entries = subjects.map((subject) => ({
            loc: `${baseUrl}/resources/${subject.id}`,
        }));
    } else if (collectionName === "syllabus") {
        const syllabi = await prisma.syllabi.findMany({
            orderBy: { name: "asc" },
            skip,
            take: PAGE_SIZE,
            select: { id: true },
        });
        entries = syllabi.map((syllabus) => ({
            loc: `${baseUrl}/syllabus/${syllabus.id}`,
        }));
    } else {
        return new NextResponse("Not found", { status: 404 });
    }

    const xml = buildUrlSetXml(entries);
    return new NextResponse(xml, {
        headers: {
            "Content-Type": "application/xml",
        },
    });
}
