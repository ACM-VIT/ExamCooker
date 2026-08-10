import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PastPaperCard from "@/app/components/past-paper-card";
import PastPapersCourseSearch from "@/app/components/past_papers/past-papers-course-search";
import StructuredData from "@/app/components/seo/structured-data";
import DirectionalTransition from "@/app/components/common/directional-transition";
import PageBreadcrumbRow from "@/app/components/common/page-breadcrumb-row";
import IntentPrefetchLink from "@/app/components/common/intent-prefetch-link";
import {
    getExamHubPageData,
    getExamHubSummaries,
} from "@/lib/data/course-exams";
import { getSearchableCourseRecords } from "@/lib/data/course-catalog";
import { examSlugToType } from "@/lib/exam-slug";
import {
    buildExamHubKeywordSet,
    getCourseExamPath,
    getExamHubPath,
} from "@/lib/seo";
import {
    buildBreadcrumbList,
    buildCollectionPage,
    buildFaqPage,
    buildItemList,
} from "@/lib/structured-data";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ exam: string }>;
}): Promise<Metadata> {
    const { exam } = await params;
    const examType = examSlugToType(exam);
    if (!examType) return { robots: { index: false, follow: true } };

    const data = await getExamHubPageData(examType);
    if (!data) return { robots: { index: false, follow: true } };

    const title = `${data.label} past papers | VIT previous year question papers`;
    const description = `Browse ${data.totalPapers} ${data.label} past papers across ${data.courseCount} VIT courses on ExamCooker.`;
    const keywords = buildExamHubKeywordSet(examType);

    return {
        title,
        description,
        keywords,
        alternates: { canonical: getExamHubPath(data.slug) },
        robots: { index: true, follow: true },
        openGraph: {
            title,
            description,
            url: getExamHubPath(data.slug),
        },
    };
}

function ExamHubShell() {
    return (
        <div
            className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-6 sm:px-6 lg:px-10 lg:py-10"
            aria-hidden="true"
        >
            <header className="flex flex-col gap-4">
                <span className="h-3 w-32 bg-black/10 dark:bg-white/10" />
                <span className="h-8 w-3/4 bg-black/10 dark:bg-white/10 sm:h-10 lg:h-12" />
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <span
                            key={index}
                            className="block h-5 w-24 bg-black/10 dark:bg-white/10"
                        />
                    ))}
                </div>
            </header>
            <div className="h-12 w-full border border-black/25 bg-white dark:border-[#D5D5D5]/30 dark:bg-[#3D414E]" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                    <div
                        key={index}
                        className="flex h-full flex-col gap-3 border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:lg:bg-[#0C1222]"
                    >
                        <span className="block h-3 w-20 bg-black/10 dark:bg-white/10" />
                        <span className="block h-5 w-full bg-black/10 dark:bg-white/10" />
                        <span className="block h-5 w-2/3 bg-black/10 dark:bg-white/10" />
                        <span className="mt-auto block h-8 w-16 bg-black/10 dark:bg-white/10" />
                    </div>
                ))}
            </div>
        </div>
    );
}

async function ExamHubContent({
    paramsPromise,
}: {
    paramsPromise: Promise<{ exam: string }>;
}) {
    const { exam } = await paramsPromise;
    const examType = examSlugToType(exam);
    if (!examType) return notFound();

    const [data, allExamHubs, searchable] = await Promise.all([
        getExamHubPageData(examType),
        getExamHubSummaries(),
        getSearchableCourseRecords(),
    ]);

    if (!data) return notFound();

    const relatedHubs = allExamHubs.filter((hub) => hub.examType !== examType).slice(0, 6);
    const description = `Browse ${data.totalPapers} ${data.label} past papers across ${data.courseCount} VIT courses on ExamCooker.`;
    const faq = [
        {
            question: `Where can I find ${data.label} past papers?`,
            answer: `This page groups ${data.label} past papers from every supported course into one crawlable hub, so students can  type and then jump into a course-specific paper collection.`,
        },
        {
            question: `Does this ${data.label} hub include different VIT courses?`,
            answer: `Yes. The hub spans ${data.courseCount} courses and links directly into the course-level ${data.label} paper page for each one.`,
        },
        {
            question: `What should I use with ${data.label} papers?`,
            answer: `Use these papers alongside notes, syllabus PDFs, and resource links for the same course to prepare faster and cover both concepts and exam pattern.`,
        },
    ];

    return (
        <>
            <StructuredData
                data={[
                    buildBreadcrumbList([
                        { name: "Past papers", path: "/past_papers" },
                        {
                            name: `${data.label} past papers`,
                            path: getExamHubPath(data.slug),
                        },
                    ]),
                        buildCollectionPage({
                            name: `${data.label} past papers`,
                            description,
                            path: getExamHubPath(data.slug),
                            keywords: buildExamHubKeywordSet(examType),
                            about: `${data.label} exam papers`,
                        }),
                        buildItemList(
                            data.courses.map((course) => ({
                                name: `${course.code} ${data.label} past papers`,
                                path: getCourseExamPath(course.code, data.slug),
                            })),
                        ),
                        buildFaqPage(faq),
                    ]}
                />
                
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 pb-6 pt-4 sm:px-6 sm:py-6 lg:px-10 lg:py-10">
                    <header className="flex flex-col gap-4">
                        <PageBreadcrumbRow
                            items={[
                                { href: "/past_papers", label: "Past papers" },
                                { label: data.label },
                            ]}
                        />

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-4xl">
                            <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                                {data.label} past papers
                            </h1>
                            <p className="sr-only">
                                Explore {data.label} previous year question papers, pyqs, and paper
                                collections across every course that has indexed {data.label} exam
                                content on ExamCooker.
                            </p>
                            <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-black/70 dark:text-[#D5D5D5]/70">
                                <span className="flex items-baseline gap-1.5">
                                    <span className="text-xl font-black leading-none text-black dark:text-[#D5D5D5]">
                                        {data.totalPapers}
                                    </span>
                                    <span className="text-xs font-semibold uppercase tracking-wider">
                                        papers
                                    </span>
                                </span>
                                <span aria-hidden="true" className="text-black dark:text-white">
                                    ·
                                </span>
                                <span className="flex items-baseline gap-1.5">
                                    <span className="text-xl font-black leading-none text-black dark:text-[#D5D5D5]">
                                        {data.courseCount}
                                    </span>
                                    <span className="text-xs font-semibold uppercase tracking-wider">
                                        courses
                                    </span>
                                </span>
                                {data.latestYear !== null && (
                                    <>
                                        <span aria-hidden="true" className="text-black dark:text-white">
                                            ·
                                        </span>
                                        <span className="flex items-baseline gap-1.5">
                                            <span className="text-xl font-black leading-none text-black dark:text-[#D5D5D5]">
                                                {data.latestYear}
                                            </span>
                                            <span className="text-xs font-semibold uppercase tracking-wider">
                                                latest
                                            </span>
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {relatedHubs.map((hub) => (
                                <Link
                                    key={hub.slug}
                                    href={getExamHubPath(hub.slug)}
                                    className="inline-flex h-9 items-center border border-black/60 px-3 text-sm font-semibold text-black transition hover:bg-[#5FC4E7]/25 dark:border-[#D5D5D5]/60 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7] dark:hover:bg-[#3BF4C7]/10 dark:hover:text-[#3BF4C7]"
                                >
                                    {hub.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </header>

                <PastPapersCourseSearch courses={searchable} />

                <section className="flex flex-col gap-4">
                    <div className="flex items-end justify-between gap-3">
                        <h2 className="text-lg font-bold uppercase tracking-wider sm:text-xl">
                            Browse courses
                        </h2>
                        <p className="text-sm text-black/60 dark:text-[#D5D5D5]/60">
                            Sorted by paper count
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                        {data.courses.map((course) => (
                            <div key={course.id} className="group relative h-full">
                                <IntentPrefetchLink
                                    href={getCourseExamPath(course.code, data.slug)}
                                    transitionTypes={["nav-forward"]}
                                    className="flex h-full flex-col gap-3 border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 text-black transition duration-200 hover:scale-[1.03] hover:shadow-xl hover:border-b-2 hover:border-b-white dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222] dark:hover:border-b-[#3BF4C7] dark:hover:bg-[#ffffff]/10"
                                >
                                    <span className="font-mono text-xs font-bold uppercase tracking-wide text-black/75 dark:text-[#D5D5D5]/70">
                                        {course.code}
                                    </span>
                                    <h3 className="line-clamp-3 text-base font-bold leading-snug text-black dark:text-[#D5D5D5]">
                                        {course.title}
                                    </h3>
                                    <div className="mt-auto flex items-end justify-between pt-1">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-bold leading-none text-black dark:text-[#D5D5D5]">
                                                {course.paperCount}
                                            </span>
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
                                                {data.label} paper{course.paperCount === 1 ? "" : "s"}
                                            </span>
                                        </div>
                                        {course.noteCount > 0 && (
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
                                                {course.noteCount} note{course.noteCount === 1 ? "" : "s"}
                                            </span>
                                        )}
                                    </div>
                                </IntentPrefetchLink>
                            </div>
                        ))}
                    </div>
                </section>

                {data.recentPapers.length > 0 && (
                    <section className="flex flex-col gap-4">
                        <div className="flex items-end justify-between gap-3">
                            <h2 className="text-lg font-bold uppercase tracking-wider sm:text-xl">
                                Recent uploads
                            </h2>
                            <p className="text-sm text-black/60 dark:text-[#D5D5D5]/60">
                                Latest {data.label} additions
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {data.recentPapers.map((paper, index) => (
                                <PastPaperCard
                                    key={paper.id}
                                    pastPaper={paper}
                                    index={index}
                                />
                            ))}
                        </div>
                    </section>
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

export default function ExamHubPage({
    params,
}: {
    params: Promise<{ exam: string }>;
}) {
    return (
        <DirectionalTransition>
            <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <Suspense fallback={<ExamHubShell />}>
                    <ExamHubContent paramsPromise={params} />
                </Suspense>
            </div>
        </DirectionalTransition>
    );
}
