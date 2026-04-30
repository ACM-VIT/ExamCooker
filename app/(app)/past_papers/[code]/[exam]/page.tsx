import React, { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { normalizeCourseCode } from "@/lib/course-tags";
import { examSlugToType, examTypeLabel, examTypeToSlug } from "@/lib/exam-slug";
import { getCourseDetailByCode } from "@/lib/data/course-catalog";
import {
    getCoursePaperFilterOptions,
    getCoursePapers,
} from "@/lib/data/course-papers";
import { getSyllabusByCourseCode } from "@/lib/data/syllabus";
import StructuredData from "@/app/components/seo/structured-data";
import DirectionalTransition from "@/app/components/common/directional-transition";
import {
    buildCourseExamKeywordSet,
    getCourseExamPath,
    getCourseNotesPath,
    getCoursePastPapersPath,
    getPastPaperDetailPath,
    getCourseSyllabusPath,
} from "@/lib/seo";
import CourseHeader from "@/app/components/past_papers/course-header";
import CoursePaperGrid from "@/app/components/past_papers/course-paper-grid";
import {
    buildBreadcrumbList,
    buildCollectionPage,
    buildFaqPage,
    buildItemList,
} from "@/lib/structured-data";

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

function CourseExamShell() {
    return (
        <div
            className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-6 sm:px-6 lg:px-10 lg:py-10"
            aria-hidden="true"
        >
            <div className="flex flex-col gap-3">
                <span className="h-3 w-32 bg-black/10 dark:bg-white/10" />
                <span className="h-8 w-2/3 bg-black/10 dark:bg-white/10 sm:h-10" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="h-6 w-32 bg-black/10 dark:bg-white/10" />
                <span className="h-9 w-28 border border-black/20 bg-white dark:border-[#D5D5D5]/20 dark:bg-[#0C1222]" />
            </div>
            <div className="flex flex-wrap gap-3">
                {Array.from({ length: 8 }).map((_, index) => (
                    <div
                        key={index}
                        className="min-w-0 basis-[calc((100%-0.75rem)/2)] sm:basis-[calc((100%-1.5rem)/3)] lg:basis-[calc((100%-2.25rem)/4)] xl:basis-[calc((100%-3rem)/5)]"
                    >
                        <div className="flex h-full flex-col border-2 border-[#5FC4E7] bg-[#5FC4E7] p-3 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:lg:bg-[#0C1222]">
                            <div className="flex flex-col gap-1.5 pb-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="h-[18px] w-12 bg-black/10 dark:bg-[#D5D5D5]/15" />
                                    <span className="h-[13px] w-8 bg-black/10 dark:bg-[#D5D5D5]/10" />
                                </div>
                                <span className="h-[14px] w-full bg-black/10 dark:bg-[#D5D5D5]/15" />
                                <span className="h-[14px] w-3/5 bg-black/10 dark:bg-[#D5D5D5]/15" />
                            </div>
                            <div className="aspect-[4/5] w-full bg-[#d9d9d9] dark:bg-white/5" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

async function CourseExamContent({
    paramsPromise,
}: {
    paramsPromise: Promise<{ code: string; exam: string }>;
}) {
    const { code, exam } = await paramsPromise;
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
        <>
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
        </>
    );
}

export default function CourseExamPage({
    params,
}: {
    params: Promise<{ code: string; exam: string }>;
}) {
    return (
        <DirectionalTransition>
            <div className="min-h-screen text-black dark:text-[#D5D5D5]">
                <Suspense fallback={<CourseExamShell />}>
                    <CourseExamContent paramsPromise={params} />
                </Suspense>
            </div>
        </DirectionalTransition>
    );
}
