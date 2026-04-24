import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { normalizeCourseCode } from "@/lib/courseTags";
import { examSlugToType, examTypeLabel, examTypeToSlug } from "@/lib/examSlug";
import { getCourseDetailByCode } from "@/lib/data/courseCatalog";
import {
    getCoursePaperFilterOptions,
    getCoursePapers,
} from "@/lib/data/coursePapers";
import { getSyllabusByCourseCode } from "@/lib/data/syllabus";
import StructuredData from "@/app/components/seo/StructuredData";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import {
    buildCourseExamKeywordSet,
    getCourseExamPath,
    getCourseNotesPath,
    getCoursePastPapersPath,
    getPastPaperDetailPath,
    getCourseSyllabusPath,
} from "@/lib/seo";
import CourseHeader from "@/app/components/past_papers/CourseHeader";
import CoursePaperGrid from "@/app/components/past_papers/CoursePaperGrid";
import {
    buildBreadcrumbList,
    buildCollectionPage,
    buildFaqPage,
    buildItemList,
} from "@/lib/structuredData";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ code: string; exam: string }>;
}): Promise<Metadata> {
    const { code, exam } = await params;
    const examType = examSlugToType(exam);
    if (!examType) return {};

    const normalized = normalizeCourseCode(code);
    const course = await getCourseDetailByCode(normalized);
    if (!course) return {};

    const label = examTypeLabel(examType);
    const title = `${course.code} ${label} past papers | ${course.title}`;
    const description = `Download ${course.code} ${label} previous year question papers for ${course.title} on ExamCooker.`;
    return {
        title,
        description,
        keywords: buildCourseExamKeywordSet({
            code: course.code,
            title: course.title,
            aliases: course.aliases,
            examType,
        }),
        alternates: {
            canonical: getCourseExamPath(course.code, examTypeToSlug(examType)),
        },
        openGraph: {
            title,
            description,
            url: getCourseExamPath(course.code, examTypeToSlug(examType)),
        },
    };
}

export default async function CourseExamPage({
    params,
}: {
    params: Promise<{ code: string; exam: string }>;
}) {
    const { code, exam } = await params;
    const examType = examSlugToType(exam);
    if (!examType) notFound();

    const normalized = normalizeCourseCode(code);
    const course = await getCourseDetailByCode(normalized);
    if (!course) notFound();

    const [options, { papers, totalCount }, syllabus] = await Promise.all([
        getCoursePaperFilterOptions(course.id),
        getCoursePapers({
            courseId: course.id,
            filters: { examTypes: [examType] },
            sort: "year_desc",
            page: 1,
            pageSize: 48,
        }),
        getSyllabusByCourseCode(course.code),
    ]);

    const label = examTypeLabel(examType);
    const description = `Download ${course.code} ${label} previous year question papers for ${course.title} on ExamCooker.`;
    const faq = [
        {
            question: `Where can I find ${course.code} ${label} past papers?`,
            answer: `This page is the canonical ${label} landing page for ${course.code}. It groups every indexed ${label} paper for ${course.title} into one route.`,
        },
        {
            question: `What should I use with ${course.code} ${label} papers?`,
            answer: `Pair these ${label} papers with ${course.code} notes and the syllabus to cover concepts, units, and exam pattern together.`,
        },
    ];

    return (
        <DirectionalTransition>
            <div className="min-h-screen text-black dark:text-[#D5D5D5]">
                <StructuredData
                    data={[
                        buildBreadcrumbList([
                            { name: "Past papers", path: "/past_papers" },
                            { name: course.title, path: getCoursePastPapersPath(course.code) },
                            {
                                name: `${course.code} ${label}`,
                                path: getCourseExamPath(course.code, examTypeToSlug(examType)),
                            },
                        ]),
                        buildCollectionPage({
                            name: `${course.code} ${label} past papers`,
                            description,
                            path: getCourseExamPath(course.code, examTypeToSlug(examType)),
                            about: course.title,
                        }),
                        buildItemList(
                            papers.map((paper) => ({
                                name: paper.title,
                                path: getPastPaperDetailPath(paper.id, course.code),
                            })),
                        ),
                        buildFaqPage(faq),
                    ]}
                />
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-6 sm:px-6 lg:px-10 lg:py-10">
                    <CourseHeader
                        code={course.code}
                        title={course.title}
                        paperCount={course.paperCount}
                        noteCount={course.noteCount}
                        syllabusId={syllabus?.id ?? null}
                    />

                <section className="rounded-md border border-black/10 bg-white p-4 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]">
                    <p className="sr-only">
                        Open the dedicated {label} collection for {course.code} when you want a
                        focused set of papers for one exam pattern instead of the full course list.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {course.noteCount > 0 && (
                            <Link
                                href={getCourseNotesPath(course.code)}
                                className="inline-flex h-9 items-center border border-black/20 px-3 text-sm font-semibold transition hover:bg-black/5 dark:border-[#D5D5D5]/20 dark:hover:bg-white/5"
                            >
                                Notes
                            </Link>
                        )}
                        {syllabus && (
                            <Link
                                href={getCourseSyllabusPath(course.code)}
                                className="inline-flex h-9 items-center border border-black/20 px-3 text-sm font-semibold transition hover:bg-black/5 dark:border-[#D5D5D5]/20 dark:hover:bg-white/5"
                            >
                                Syllabus
                            </Link>
                        )}
                    </div>
                </section>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60">
                            Filtered view
                        </p>
                        <h2 className="text-xl font-bold sm:text-2xl">{label}</h2>
                        <p className="mt-1 text-sm text-black/70 dark:text-[#D5D5D5]/70">
                            {totalCount} paper{totalCount === 1 ? "" : "s"}
                        </p>
                    </div>
                    <Link
                        href={getCoursePastPapersPath(course.code)}
                        transitionTypes={["nav-back"]}
                        className="inline-flex h-9 items-center border border-black/60 px-3 text-sm font-semibold text-black transition hover:bg-[#5FC4E7]/25 dark:border-[#D5D5D5]/60 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7] dark:hover:bg-[#3BF4C7]/10 dark:hover:text-[#3BF4C7]"
                    >
                        All filters →
                    </Link>
                </div>

                {options.examTypes.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                        {options.examTypes
                            .filter((t) => t !== examType)
                            .map((type) => (
                                <Link
                                    key={type}
                                    href={getCourseExamPath(course.code, examTypeToSlug(type))}
                                    transitionTypes={["nav-forward"]}
                                    className="inline-flex h-8 items-center border border-black/30 px-3 text-xs font-semibold text-black transition hover:bg-black/5 dark:border-[#D5D5D5]/40 dark:text-[#D5D5D5] dark:hover:bg-white/5"
                                >
                                    {examTypeLabel(type)}
                                </Link>
                            ))}
                    </div>
                )}

                {papers.length === 0 ? (
                    <div className="border-2 border-dashed border-black/20 p-10 text-center dark:border-[#D5D5D5]/20">
                        <p className="text-sm text-black/70 dark:text-[#D5D5D5]/70">
                            No {label} papers yet for {course.code}.
                        </p>
                    </div>
                ) : (
                    <CoursePaperGrid
                        papers={papers}
                        courseCode={course.code}
                        courseTitle={course.title}
                    />
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
        </DirectionalTransition>
    );
}
