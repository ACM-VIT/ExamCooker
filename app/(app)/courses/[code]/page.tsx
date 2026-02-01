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
    const title = buildCourseTitle(course);
    return (
        <div className="min-h-screen text-black dark:text-gray-200 flex flex-col p-8">
            <div className="w-full max-w-6xl mx-auto flex flex-col gap-10">
                <header className="space-y-4 text-center">
                    <div className="space-y-2">
                        <h1 className="text-3xl sm:text-4xl font-bold">{course.title}</h1>
                        <p className="text-sm text-black/70 dark:text-white/70 tracking-wide">
                            {course.code}
                        </p>
                    </div>
                    {/** Keep all header actions visually consistent */}
                    {(() => {
                        const pillClass =
                            "inline-flex items-center gap-2 rounded-full border border-black/20 dark:border-white/20 bg-white/60 dark:bg-white/5 text-black dark:text-white text-xs font-semibold px-3 py-1 hover:border-black/40 dark:hover:border-white/40 hover:bg-white/90 dark:hover:bg-white/10 transition";
                        const mutedPillClass =
                            "inline-flex items-center gap-2 rounded-full border border-black/15 dark:border-white/15 bg-white/40 dark:bg-white/5 text-black/70 dark:text-white/70 text-xs font-semibold px-3 py-1";
                        return (
                            <>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        {syllabus ? (
                            <Link
                                href={`/syllabus/${syllabus.id}`}
                                className={pillClass}
                            >
                                View syllabus
                            </Link>
                        ) : null}
                        {paperCount > 0 ? (
                            <span className={mutedPillClass}>
                                {paperCount} past papers
                            </span>
                        ) : null}
                        {noteCount > 0 ? (
                            <span className={mutedPillClass}>
                                {noteCount} notes
                            </span>
                        ) : null}
                    </div>
                    {examCounts.length ? (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {examCounts.map((exam) => (
                                <Link
                                    key={exam.slug}
                                    href={`/courses/${encodeURIComponent(course.code)}/${exam.slug}`}
                                    className={pillClass}
                                >
                                    <span>{exam.label}</span>
                                    <span className="text-[10px] px-2 py-[1px] rounded-full border border-black/20 dark:border-white/20 bg-white/70 dark:bg-white/10">
                                        {exam.count}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    ) : null}
                            </>
                        );
                    })()}
                </header>

                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Past papers</h2>
                        {paperCount > PREVIEW_PAGE_SIZE ? (
                            <Link
                                href={`/past_papers?search=${encodeURIComponent(course.code)}`}
                                className="text-sm underline"
                            >
                                View all
                            </Link>
                        ) : null}
                    </div>
                {pastPapers.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {pastPapers.map((paper, index) => (
                            <PastPaperCard key={paper.id} pastPaper={paper} index={index} />
                        ))}
                    </div>
                ) : null}
            </section>

            {notes.length ? (
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Notes</h2>
                        {noteCount > PREVIEW_PAGE_SIZE ? (
                            <Link
                                href={`/notes?search=${encodeURIComponent(course.code)}`}
                                className="text-sm underline"
                            >
                                View all
                            </Link>
                        ) : null}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {notes.map((note, index) => (
                            <NotesCard key={note.id} note={note} index={index} />
                        ))}
                    </div>
                </section>
            ) : null}
            </div>
        </div>
    );
}
