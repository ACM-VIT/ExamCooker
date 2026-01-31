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

    const { notes, pastPapers, noteCount, paperCount } = await fetchCourseContent(course);
    const examCounts = await getCourseExamCounts(course.tagIds);
    const title = buildCourseTitle(course);
    return (
        <div className="min-h-screen text-black dark:text-gray-200 flex flex-col gap-8 p-8">
            <header className="space-y-3 text-center">
                <h1 className="text-3xl sm:text-4xl font-bold">{course.title}</h1>
                <p className="text-sm text-black/70 dark:text-white/70">{course.code}</p>
                {examCounts.length ? (
                    <div className="flex flex-wrap justify-center gap-2">
                        {examCounts.map((exam) => (
                            <Link
                                key={exam.slug}
                                href={`/courses/${encodeURIComponent(course.code)}/${exam.slug}`}
                                className="px-3 py-1 rounded-full text-xs bg-white/70 dark:bg-white/10 border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 transition"
                            >
                                {exam.label} ({exam.count})
                            </Link>
                        ))}
                    </div>
                ) : null}
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
                ) : (
                    <p className="text-sm text-black/70 dark:text-white/70">
                        No past papers for this course yet.
                    </p>
                )}
            </section>

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
                {notes.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {notes.map((note, index) => (
                            <NotesCard key={note.id} note={note} index={index} />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-black/70 dark:text-white/70">
                        No notes for this course yet.
                    </p>
                )}
            </section>
        </div>
    );
}
