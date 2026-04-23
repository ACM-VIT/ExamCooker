import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NotesCard from "@/app/components/NotesCard";
import PastPaperCard from "@/app/components/PastPaperCard";
import StructuredData from "@/app/components/seo/StructuredData";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { getCourseByCodeAny } from "@/lib/data/courses";
import { getCourseDetailByCode } from "@/lib/data/courseCatalog";
import {
    buildCourseKeywordSet,
    getCourseExamPath,
    getCourseNotesPath,
    getCoursePastPapersPath,
    getCoursePath,
    getCourseResourcesPath,
    getCourseSyllabusPath,
} from "@/lib/seo";
import { normalizeCourseCode } from "@/lib/courseTags";
import { getCourseExamCounts } from "@/lib/data/courseExams";
import { getSubjectByCourseCode } from "@/lib/data/resources";
import { getSyllabusByCourseCode } from "@/lib/data/syllabus";
import {
    buildBreadcrumbList,
    buildCourseStructuredData,
    buildFaqPage,
    buildItemList,
} from "@/lib/structuredData";

const PREVIEW_PAGE_SIZE = 6;

function buildCourseTitle(course: { title: string; code: string }) {
    return `${course.title} (${course.code})`;
}

async function loadCourseContext(rawCode: string) {
    const normalized = normalizeCourseCode(rawCode);
    if (!normalized) return null;

    const [tagCourse, courseDetail] = await Promise.all([
        getCourseByCodeAny(normalized),
        getCourseDetailByCode(normalized),
    ]);

    if (!tagCourse && !courseDetail) {
        return null;
    }

    return {
        code: courseDetail?.code ?? tagCourse?.code ?? normalized,
        title: courseDetail?.title ?? tagCourse?.title ?? normalized,
        aliases: courseDetail?.aliases ?? [],
        tagIds: tagCourse?.tagIds ?? [],
        courseId: courseDetail?.id ?? null,
    };
}

function buildCourseWhere(input: { courseId?: string | null; tagIds: string[] }) {
    const or = [];

    if (input.courseId) {
        or.push({ courseId: input.courseId });
    }

    if (input.tagIds.length > 0) {
        or.push({ tags: { some: { id: { in: input.tagIds } } } });
    }

    if (or.length === 0) {
        return { id: "__missing-course-context__" };
    }

    return {
        isClear: true,
        OR: or,
    };
}

async function fetchCourseContent(course: { courseId?: string | null; tagIds: string[] }) {
    const noteWhere = buildCourseWhere(course);
    const paperWhere = buildCourseWhere(course);

    const [notes, pastPapers, noteCount, paperCount] = await Promise.all([
        prisma.note.findMany({
            where: noteWhere,
            orderBy: { createdAt: "desc" },
            take: PREVIEW_PAGE_SIZE,
            select: { id: true, title: true, thumbNailUrl: true },
        }),
        prisma.pastPaper.findMany({
            where: paperWhere,
            orderBy: { createdAt: "desc" },
            take: PREVIEW_PAGE_SIZE,
            select: { id: true, title: true, thumbNailUrl: true },
        }),
        prisma.note.count({
            where: noteWhere,
        }),
        prisma.pastPaper.count({
            where: paperWhere,
        }),
    ]);

    return {
        notes: notes.map((note) => ({
            ...note,
            thumbNailUrl: normalizeGcsUrl(note.thumbNailUrl) ?? note.thumbNailUrl,
        })),
        pastPapers: pastPapers.map((paper) => ({
            ...paper,
            thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? paper.thumbNailUrl,
        })),
        noteCount,
        paperCount,
    };
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ code: string }>;
}): Promise<Metadata> {
    const { code } = await params;
    const course = await loadCourseContext(code);
    if (!course) return {};

    const title = buildCourseTitle(course);
    const description = `Browse notes, past papers, syllabus links, and study resources for ${course.title} on ExamCooker.`;

    return {
        title,
        description,
        keywords: buildCourseKeywordSet({
            code: course.code,
            title: course.title,
            aliases: course.aliases,
            intents: [
                "past papers",
                "notes",
                "syllabus",
                "resources",
                "previous year question papers",
            ],
        }),
        alternates: { canonical: getCoursePath(course.code) },
        openGraph: {
            title,
            description,
            url: getCoursePath(course.code),
        },
    };
}

export default async function CourseDetailPage({
    params,
}: {
    params: Promise<{ code: string }>;
}) {
    const { code } = await params;
    const course = await loadCourseContext(code);

    if (!course) return notFound();

    const [{ notes, pastPapers, noteCount, paperCount }, examCounts, syllabus, subject] =
        await Promise.all([
            fetchCourseContent(course),
            getCourseExamCounts({
                courseId: course.courseId,
                tagIds: course.tagIds,
            }),
            getSyllabusByCourseCode(course.code),
            getSubjectByCourseCode(course.code),
        ]);

    const hasAnyResource = paperCount > 0 || noteCount > 0 || Boolean(syllabus) || Boolean(subject);
    const description = `Browse notes, past papers, syllabus links, and study resources for ${course.title} on ExamCooker.`;
    const faq = [
        {
            question: `Where can I find ${course.code} past papers and notes?`,
            answer: `This course page links to the dedicated ${course.code} paper, note, syllabus, and resource pages so students can move between revision material and exam practice quickly.`,
        },
        {
            question: `Does ${course.code} have exam-specific paper pages?`,
            answer: `Yes. When ExamCooker has enough structured data for a specific exam type, this page links directly into the canonical course exam collection for that course.`,
        },
    ];

    return (
        <div className="min-h-screen text-black dark:text-[#D5D5D5] flex flex-col px-3 py-3 sm:p-4 lg:p-8">
            <StructuredData
                data={[
                    buildBreadcrumbList([
                        { name: "Courses", path: "/courses" },
                        { name: course.title, path: getCoursePath(course.code) },
                    ]),
                    buildCourseStructuredData({
                        code: course.code,
                        title: course.title,
                        description,
                        path: getCoursePath(course.code),
                    }),
                    buildItemList(
                        examCounts.map((exam) => ({
                            name: `${course.code} ${exam.label} past papers`,
                            path: getCourseExamPath(course.code, exam.slug),
                        })),
                    ),
                    buildFaqPage(faq),
                ]}
            />
            <div className="w-full max-w-6xl mx-auto flex flex-col">
                <header className="text-center mb-6 sm:mb-8">
                    <h1 className="leading-tight">{course.title}</h1>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-black/60 dark:text-[#D5D5D5]/60">
                        <span>{course.code}</span>
                        {syllabus && (
                            <>
                                <span aria-hidden="true">·</span>
                                <Link
                                    href={getCourseSyllabusPath(course.code)}
                                    className="underline underline-offset-2 hover:text-black dark:hover:text-[#3BF4C7]"
                                >
                                    View syllabus
                                </Link>
                            </>
                        )}
                        {subject && (
                            <>
                                <span aria-hidden="true">·</span>
                                <Link
                                    href={getCourseResourcesPath(course.code)}
                                    className="underline underline-offset-2 hover:text-black dark:hover:text-[#3BF4C7]"
                                >
                                    View resources
                                </Link>
                            </>
                        )}
                    </div>
                    <p className="sr-only">
                        Use this course hub to jump into notes, past papers, syllabus PDFs, and
                        module resources for {course.title}. Everything important for {course.code}
                        is linked here in one place.
                    </p>
                </header>

                {examCounts.length > 0 && (
                    <div className="mb-6 sm:mb-8 flex flex-wrap justify-center gap-2">
                        {examCounts.map((exam) => (
                            <Link
                                key={exam.slug}
                                href={getCourseExamPath(course.code, exam.slug)}
                                className="inline-flex h-9 items-center gap-2 border border-black/70 px-3 text-sm font-semibold text-black transition-colors hover:bg-[#5FC4E7]/25 dark:border-[#D5D5D5]/60 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7] dark:hover:bg-[#3BF4C7]/10 dark:hover:text-[#3BF4C7]"
                            >
                                {exam.label}
                                <span className="text-black/55 dark:text-[#D5D5D5]/55 font-normal">
                                    {exam.count}
                                </span>
                            </Link>
                        ))}
                    </div>
                )}

                {pastPapers.length > 0 && (
                    <section className="mb-10 sm:mb-12">
                        <div className="mb-4 flex items-end justify-between gap-3">
                            <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-[#D5D5D5]">
                                Past papers
                            </h2>
                            {paperCount > PREVIEW_PAGE_SIZE && (
                                <Link
                                    href={getCoursePastPapersPath(course.code)}
                                    className="text-sm text-black/70 underline underline-offset-2 hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                                >
                                    View all {paperCount} →
                                </Link>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                            {pastPapers.map((paper, index) => (
                                <div
                                    key={paper.id}
                                    className="flex justify-center"
                                >
                                    <PastPaperCard
                                        pastPaper={paper}
                                        index={index}
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {notes.length > 0 && (
                    <section>
                        <div className="mb-4 flex items-end justify-between gap-3">
                            <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-[#D5D5D5]">
                                Notes
                            </h2>
                            {noteCount > PREVIEW_PAGE_SIZE && (
                                <Link
                                    href={getCourseNotesPath(course.code)}
                                    className="text-sm text-black/70 underline underline-offset-2 hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                                >
                                    View all {noteCount} →
                                </Link>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                            {notes.map((note, index) => (
                                <NotesCard
                                    key={note.id}
                                    note={note}
                                    index={index}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {!hasAnyResource && (
                    <p className="text-center text-sm text-black/60 dark:text-[#D5D5D5]/60">
                        No resources yet for this course.
                    </p>
                )}

                <section className="sr-only">
                    {faq.map((item) => (
                        <article
                            key={item.question}
                            className="rounded-md border border-black/10 bg-white p-4 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]"
                        >
                            <h2 className="text-base font-bold">{item.question}</h2>
                            <p className="mt-2 text-sm text-black/70 dark:text-[#D5D5D5]/70">
                                {item.answer}
                            </p>
                        </article>
                    ))}
                </section>
            </div>
        </div>
    );
}
