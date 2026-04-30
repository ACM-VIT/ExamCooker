import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import {
    getBaseUrl,
    getCourseExamPath,
    getCourseNotesPath,
    getCourseResourcesPath,
    getCourseSyllabusPath,
    getExamHubPath,
    getPastPaperDetailPath,
    parseSubjectName,
    parseSyllabusName,
    safeEncodeURIComponent,
} from "@/lib/seo";
import {
    getCourseGrid,
    getCourseSearchRecords,
} from "@/lib/data/course-catalog";
import {
    getCourseExamCombos,
    getExamHubSummaries,
} from "@/lib/data/course-exams";
import { course, db, note, pastPaper, subject, syllabi } from "@/db";

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
            { loc: `${baseUrl}/resources` },
            { loc: `${baseUrl}/syllabus` },
        ];
    } else if (collectionName === "notes") {
        const notes = await db
            .select({
                id: note.id,
                updatedAt: note.updatedAt,
            })
            .from(note)
            .where(eq(note.isClear, true))
            .orderBy(desc(note.updatedAt))
            .offset(skip)
            .limit(PAGE_SIZE);

        entries = notes.map((note) => ({
            loc: `${baseUrl}/notes/${note.id}`,
            lastmod: note.updatedAt.toISOString(),
        }));
    } else if (collectionName === "past-papers") {
        const papers = await db
            .select({
                id: pastPaper.id,
                updatedAt: pastPaper.updatedAt,
                courseCode: course.code,
            })
            .from(pastPaper)
            .leftJoin(course, eq(pastPaper.courseId, course.id))
            .where(eq(pastPaper.isClear, true))
            .orderBy(desc(pastPaper.updatedAt))
            .offset(skip)
            .limit(PAGE_SIZE);

        entries = papers.map((paper) => ({
            loc: `${baseUrl}${getPastPaperDetailPath(paper.id, paper.courseCode ?? null)}`,
            lastmod: paper.updatedAt.toISOString(),
        }));
    } else if (collectionName === "courses") {
        const courses = await getCourseGrid();
        const pageItems = courses.slice(skip, skip + PAGE_SIZE);
        entries = pageItems.map((course) => ({
            loc: `${baseUrl}/past_papers/${safeEncodeURIComponent(course.code)}`,
        }));
    } else if (collectionName === "course-exams") {
        const combos = await getCourseExamCombos();
        const pageItems = combos.slice(skip, skip + PAGE_SIZE);
        entries = pageItems.map((combo) => ({
            loc: `${baseUrl}${getCourseExamPath(combo.code, combo.examSlug)}`,
        }));
    } else if (collectionName === "course-notes") {
        const courses = await getCourseSearchRecords();
        const pageItems = courses
            .filter((course) => course.noteCount > 0)
            .slice(skip, skip + PAGE_SIZE);
        entries = pageItems.map((course) => ({
            loc: `${baseUrl}${getCourseNotesPath(course.code)}`,
        }));
    } else if (collectionName === "resources") {
        const subjects = await db
            .select({
                id: subject.id,
                name: subject.name,
            })
            .from(subject)
            .orderBy(subject.name)
            .offset(skip)
            .limit(PAGE_SIZE);

        entries = subjects.map((subject) => ({
            loc: `${baseUrl}${(() => {
                const parsed = parseSubjectName(subject.name);
                return parsed.courseCode
                    ? getCourseResourcesPath(parsed.courseCode)
                    : `/resources/${subject.id}`;
            })()}`,
        }));
    } else if (collectionName === "syllabus") {
        const syllabusRows = await db
            .select({
                id: syllabi.id,
                name: syllabi.name,
            })
            .from(syllabi)
            .orderBy(syllabi.name)
            .offset(skip)
            .limit(PAGE_SIZE);

        entries = syllabusRows.map((syllabus) => ({
            loc: `${baseUrl}${(() => {
                const parsed = parseSyllabusName(syllabus.name);
                return parsed.courseCode
                    ? getCourseSyllabusPath(parsed.courseCode)
                    : `/syllabus/${syllabus.id}`;
            })()}`,
        }));
    } else if (collectionName === "exam-hubs") {
        const hubs = await getExamHubSummaries();
        const pageItems = hubs.slice(skip, skip + PAGE_SIZE);
        entries = pageItems.map((hub) => ({
            loc: `${baseUrl}${getExamHubPath(hub.slug)}`,
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
