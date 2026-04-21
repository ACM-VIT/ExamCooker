import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NotesCard from "@/app/components/NotesCard";
import PastPaperCard from "@/app/components/PastPaperCard";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { getCourseByCodeAny } from "@/lib/data/courses";
import { buildKeywords, DEFAULT_KEYWORDS } from "@/lib/seo";
import { normalizeCourseCode } from "@/lib/courseTags";
import { getCourseExamCounts } from "@/lib/data/courseExams";
import { getSyllabusByCourseCode } from "@/lib/data/syllabus";

const PREVIEW_PAGE_SIZE = 6;

function buildCourseTitle(course: { title: string; code: string }) {
    return `${course.title} (${course.code})`;
}

async function fetchCourseContent(course: { code: string; tagIds: string[] }) {
    const [notes, pastPapers, noteCount, paperCount] = await Promise.all([
        prisma.note.findMany({
            where: { isClear: true, tags: { some: { id: { in: course.tagIds } } } },
            orderBy: { createdAt: "desc" },
            take: PREVIEW_PAGE_SIZE,
            select: { id: true, title: true, thumbNailUrl: true },
        }),
        prisma.pastPaper.findMany({
            where: { isClear: true, tags: { some: { id: { in: course.tagIds } } } },
            orderBy: { createdAt: "desc" },
            take: PREVIEW_PAGE_SIZE,
            select: { id: true, title: true, thumbNailUrl: true },
        }),
        prisma.note.count({
            where: { isClear: true, tags: { some: { id: { in: course.tagIds } } } },
        }),
        prisma.pastPaper.count({
            where: { isClear: true, tags: { some: { id: { in: course.tagIds } } } },
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
    const normalized = normalizeCourseCode(code);
    const course = await getCourseByCodeAny(normalized);
    if (!course) return {};

    const title = buildCourseTitle(course);
    const description = `Browse notes and past papers for ${course.title} on ExamCooker.`;

    return {
        title,
        description,
        keywords: buildKeywords(DEFAULT_KEYWORDS, [course.title, course.code]),
        alternates: { canonical: `/courses/${course.code}` },
        openGraph: {
            title,
            description,
            url: `/courses/${course.code}`,
        },
    };
}

export default async function CourseDetailPage({
    params,
}: {
    params: Promise<{ code: string }>;
}) {
    const { code } = await params;
    const normalized = normalizeCourseCode(code);
    const course = await getCourseByCodeAny(normalized);

    if (!course) return notFound();

    const [{ notes, pastPapers, noteCount, paperCount }, examCounts, syllabus] =
        await Promise.all([
            fetchCourseContent(course),
            getCourseExamCounts(course.tagIds),
            getSyllabusByCourseCode(course.code),
        ]);

    const hasAnyResource = paperCount > 0 || noteCount > 0 || Boolean(syllabus);

    return (
        <div className="min-h-screen text-black dark:text-[#D5D5D5] flex flex-col px-3 py-3 sm:p-4 lg:p-8">
            <div className="w-full max-w-6xl mx-auto flex flex-col">
                <header className="text-center mb-6 sm:mb-8">
                    <h1 className="leading-tight">{course.title}</h1>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-black/60 dark:text-[#D5D5D5]/60">
                        <span>{course.code}</span>
                        {syllabus && (
                            <>
                                <span aria-hidden="true">·</span>
                                <Link
                                    href={`/syllabus/${syllabus.id}`}
                                    className="underline underline-offset-2 hover:text-black dark:hover:text-[#3BF4C7]"
                                >
                                    View syllabus
                                </Link>
                            </>
                        )}
                    </div>
                </header>

                {examCounts.length > 0 && (
                    <div className="mb-6 sm:mb-8 flex flex-wrap justify-center gap-2">
                        {examCounts.map((exam) => (
                            <Link
                                key={exam.slug}
                                href={`/courses/${encodeURIComponent(course.code)}/${exam.slug}`}
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
                                    href={`/past_papers?search=${encodeURIComponent(course.code)}`}
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
                                    href={`/notes?search=${encodeURIComponent(course.code)}`}
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
            </div>
        </div>
    );
}
