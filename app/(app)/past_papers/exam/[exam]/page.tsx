import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PastPaperCard from "@/app/components/past-paper-card";
import StructuredData from "@/app/components/seo/structured-data";
import DirectionalTransition from "@/app/components/common/directional-transition";
import PageBreadcrumbRow from "@/app/components/common/page-breadcrumb-row";
import {
    getExamHubPageData,
    getExamHubSummaries,
} from "@/lib/data/course-exams";
import { examSlugToType } from "@/lib/exam-slug";
import {
    buildExamHubKeywordSet,
    getCourseExamPath,
    getCourseNotesPath,
    getCoursePastPapersPath,
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
            </header>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="rounded-md border border-black/10 bg-white px-4 py-3 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]"
                    >
                        <span className="block h-3 w-16 bg-black/10 dark:bg-white/10" />
                        <span className="mt-2 block h-6 w-12 bg-black/10 dark:bg-white/10" />
                    </div>
                ))}
            </section>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="rounded-md border border-black/10 bg-white p-4 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]"
                    >
                        <span className="block h-3 w-20 bg-black/10 dark:bg-white/10" />
                        <span className="mt-2 block h-5 w-full bg-black/10 dark:bg-white/10" />
                        <span className="mt-2 block h-3 w-2/3 bg-black/10 dark:bg-white/10" />
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

    const [data, allExamHubs] = await Promise.all([
        getExamHubPageData(examType),
        getExamHubSummaries(),
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
                
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-6 sm:px-6 lg:px-10 lg:py-10">
                    <header className="flex flex-col gap-4">
                        <PageBreadcrumbRow
                            items={[
                                { href: "/past_papers", label: "Past papers" },
                                { label: data.label },
                            ]}
                        />

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-4xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/55 dark:text-[#3BF4C7]/80">
                                Exam hub
                            </p>
                            <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                                {data.label} past papers
                            </h1>
                            <p className="sr-only">
                                Explore {data.label} previous year question papers, pyqs, and paper
                                collections across every course that has indexed {data.label} exam
                                content on ExamCooker.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {relatedHubs.map((hub) => (
                                <Link
                                    key={hub.slug}
                                    href={getExamHubPath(hub.slug)}
                                    className="inline-flex h-9 items-center border border-black/20 px-3 text-sm font-semibold transition hover:bg-black/5 dark:border-[#D5D5D5]/20 dark:hover:bg-white/5"
                                >
                                    {hub.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </header>

                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-md border border-black/10 bg-white px-4 py-3 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-black/55 dark:text-[#D5D5D5]/55">
                            Papers
                        </div>
                        <div className="mt-1 text-2xl font-black">{data.totalPapers}</div>
                    </div>
                    <div className="rounded-md border border-black/10 bg-white px-4 py-3 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-black/55 dark:text-[#D5D5D5]/55">
                            Courses
                        </div>
                        <div className="mt-1 text-2xl font-black">{data.courseCount}</div>
                    </div>
                    <div className="rounded-md border border-black/10 bg-white px-4 py-3 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-black/55 dark:text-[#D5D5D5]/55">
                            Latest year
                        </div>
                        <div className="mt-1 text-2xl font-black">{data.latestYear ?? "NA"}</div>
                    </div>
                    <div className="rounded-md border border-black/10 bg-white px-4 py-3 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-black/55 dark:text-[#D5D5D5]/55">
                            Route
                        </div>
                        <div className="mt-1 text-sm font-bold uppercase tracking-wider">
                            /exam/{data.slug}
                        </div>
                    </div>
                </section>

                <section className="flex flex-col gap-4">
                    <div className="flex items-end justify-between gap-3">
                        <h2 className="text-xl font-bold uppercase tracking-wider sm:text-2xl">
                            Browse courses
                        </h2>
                        <p className="text-sm text-black/60 dark:text-[#D5D5D5]/60">
                            Sorted by paper count
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {data.courses.map((course) => (
                            <article
                                key={course.id}
                                className="rounded-md border border-black/10 bg-white p-4 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-black/55 dark:text-[#3BF4C7]/80">
                                            {course.code}
                                        </p>
                                        <h3 className="mt-1 text-lg font-bold leading-snug">
                                            {course.title}
                                        </h3>
                                    </div>
                                    {course.latestYear !== null && (
                                        <span className="rounded bg-[#5FC4E7]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1b6f8f] dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]">
                                            {course.latestYear}
                                        </span>
                                    )}
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2 text-xs text-black/65 dark:text-[#D5D5D5]/65">
                                    <span>{course.paperCount} {data.label} paper{course.paperCount === 1 ? "" : "s"}</span>
                                    {course.noteCount > 0 && (
                                        <span>· {course.noteCount} note{course.noteCount === 1 ? "" : "s"}</span>
                                    )}
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Link
                                        href={getCourseExamPath(course.code, data.slug)}
                                        transitionTypes={["nav-forward"]}
                                        className="inline-flex h-9 items-center border border-black/20 px-3 text-sm font-semibold transition hover:bg-black/5 dark:border-[#D5D5D5]/20 dark:hover:bg-white/5"
                                    >
                                        {data.label} papers
                                    </Link>
                                    <Link
                                        href={getCoursePastPapersPath(course.code)}
                                        transitionTypes={["nav-forward"]}
                                        className="inline-flex h-9 items-center border border-black/20 px-3 text-sm font-semibold transition hover:bg-black/5 dark:border-[#D5D5D5]/20 dark:hover:bg-white/5"
                                    >
                                        All papers
                                    </Link>
                                    {course.noteCount > 0 && (
                                        <Link
                                            href={getCourseNotesPath(course.code)}
                                            className="inline-flex h-9 items-center border border-black/20 px-3 text-sm font-semibold transition hover:bg-black/5 dark:border-[#D5D5D5]/20 dark:hover:bg-white/5"
                                        >
                                            Notes
                                        </Link>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                {data.recentPapers.length > 0 && (
                    <section className="flex flex-col gap-4">
                        <div className="flex items-end justify-between gap-3">
                            <h2 className="text-xl font-bold uppercase tracking-wider sm:text-2xl">
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
