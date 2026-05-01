import React, { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import UploadButtonPaper from "@/app/components/upload-button-paper";
import StructuredData from "@/app/components/seo/structured-data";
import DirectionalTransition from "@/app/components/common/directional-transition";
import { GradientText } from "@/app/components/landing_page/landing";
import SmartCourseGrid from "@/app/components/past_papers/smart-course-grid";
import CoursePagination from "@/app/components/past_papers/course-pagination";
import RecentPaperStrip from "@/app/components/past_papers/recent-paper-strip";
import PastPapersCourseSearch from "@/app/components/past_papers/past-papers-course-search";
import UpcomingExamsStrip from "@/app/components/past_papers/upcoming-exams-strip";
import {
    getCatalogStats,
    getCourseSearchRecords,
    getCourseGrid,
    getPopularCourseGrid,
    getRecentPapers,
    getUpcomingExamsCourseGrid,
    searchCourseGrid,
    type CourseGridItem,
} from "@/lib/data/course-catalog";
import { getUpcomingExams } from "@/lib/data/upcoming-exams";
import {
    buildKeywords,
    DEFAULT_KEYWORDS,
} from "@/lib/seo";
import {
    buildCollectionPage,
    buildFaqPage,
} from "@/lib/structured-data";

const PAGE_SIZE = 24;
const POPULAR_LIMIT = 12;
const COURSE_GRID_CLASS = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";
type PastPapersSearchParams = { search?: string; page?: string };

function buildSearchString(params: PastPapersSearchParams) {
    const searchParams = new URLSearchParams();
    if (params.search) {
        searchParams.set("search", params.search);
    }
    if (params.page) {
        searchParams.set("page", params.page);
    }
    return searchParams.toString();
}

export async function generateMetadata({
    searchParams,
}: {
    searchParams?: Promise<{ search?: string; page?: string }>;
}): Promise<Metadata> {
    const params = (await searchParams) ?? {};
    const search = params.search?.trim() || "";
    const page = Number.parseInt(params.page || "1", 10) || 1;
    const isIndexable = !search && page <= 1;
    const title = search ? `Past papers matching "${search}"` : "Past papers";
    const description = search
        ? `Courses matching ${search} on ExamCooker.`
        : "Browse VIT past papers by course — CAT-1, CAT-2, FAT, and quiz question papers filtered by slot, year, and more.";

    return {
        title,
        description,
        keywords: buildKeywords(DEFAULT_KEYWORDS, search ? [search] : []),
        alternates: { canonical: "/past_papers" },
        robots: { index: isIndexable, follow: true },
    };
}

function validatePage(page: number, totalPages: number): number {
    if (Number.isNaN(page) || page < 1) return 1;
    if (totalPages > 0 && page > totalPages) return totalPages;
    return page;
}

function formatNumber(n: number) {
    return n.toLocaleString("en-US");
}

function HeroStats({
    stats,
}: {
    stats: { courseCount: number; paperCount: number; noteCount: number };
}) {
    const items = [
        { label: "courses", value: stats.courseCount },
        { label: "papers", value: stats.paperCount },
        { label: "notes", value: stats.noteCount },
    ];
    return (
        <div className="grid grid-cols-3 gap-2 text-black/70 dark:text-[#D5D5D5]/70 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-5 sm:gap-y-1">
            {items.map((item, idx) => (
                <div
                    key={item.label}
                    className="flex min-w-0 flex-col items-start gap-0.5 text-left sm:flex-row sm:items-baseline sm:gap-1.5"
                >
                    <span className="text-[1.7rem] font-black leading-none text-black dark:text-[#D5D5D5] sm:text-xl">
                        {formatNumber(item.value)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-xs sm:tracking-wider">
                        {item.label}
                    </span>
                    {idx < items.length - 1 && (
                        <span
                            aria-hidden="true"
                            className="ml-3 hidden text-black dark:text-white sm:inline"
                        >
                            ·
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

function CourseCardsShell({ count }: { count: number }) {
    return (
        <div className={COURSE_GRID_CLASS} aria-hidden="true">
            {Array.from({ length: count }).map((_, index) => (
                <div className="group relative h-full" key={index}>
                    <div className="flex h-full flex-col gap-3 border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 text-black transition duration-200 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222]">
                        <span className="font-mono text-xs font-bold uppercase tracking-wide text-black/75 dark:text-[#D5D5D5]/70">
                            <span className="block h-[1em] w-20 bg-black/10 dark:bg-white/10" />
                        </span>
                        <h3 className="line-clamp-3 text-base font-bold leading-snug text-black dark:text-[#D5D5D5]">
                            <span className="block h-[1em] w-full bg-black/10 dark:bg-white/10" />
                            <span className="mt-1.5 block h-[1em] w-4/5 bg-black/10 dark:bg-white/10" />
                        </h3>
                        <div className="mt-auto flex items-end justify-between pt-1">
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold leading-none text-black dark:text-[#D5D5D5]">
                                    <span className="block h-[1em] w-10 bg-black/10 dark:bg-white/10" />
                                </span>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
                                    <span className="block h-[1em] w-12 bg-black/10 dark:bg-white/10" />
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function PopularCoursesShell() {
    return (
        <section className="flex flex-col gap-4">
            <header className="flex items-end justify-between">
                <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
                    Upcoming exams
                </h2>
            </header>
            <CourseCardsShell count={POPULAR_LIMIT} />
        </section>
    );
}

function CourseGridSectionShell({ search }: { search: string }) {
    return (
        <section className="flex flex-col gap-4">
            <header className="flex items-end justify-between gap-3">
                <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
                    {search ? "Matches" : "All courses"}
                </h2>
                {!search && (
                    <span className="text-sm text-black/60 dark:text-[#D5D5D5]/60">
                        &nbsp;
                    </span>
                )}
            </header>
            <CourseCardsShell count={PAGE_SIZE} />
            <div className="mt-4 flex justify-center" aria-hidden="true">
                <nav className="flex flex-wrap items-center justify-center gap-1">
                    {["‹", "1", "2", "3", "4", "5", "›"].map((label, index) => (
                        <span
                            key={`${label}-${index}`}
                            className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center border px-3 text-sm font-semibold transition ${
                                index === 1
                                    ? "border-black bg-[#5FC4E7] text-black dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/20 dark:text-[#3BF4C7]"
                                    : "border-black/30 text-black dark:border-[#D5D5D5]/40 dark:text-[#D5D5D5]"
                            }`}
                        >
                            {label}
                        </span>
                    ))}
                </nav>
            </div>
        </section>
    );
}

function RecentSectionShell() {
    return (
        <section className="flex flex-col gap-4">
            <header className="flex items-end justify-between">
                <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
                    Recently added
                </h2>
            </header>
            <div
                aria-hidden="true"
                className="flex snap-x snap-mandatory gap-3 overflow-hidden pb-2"
            >
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="flex w-40 shrink-0 flex-col overflow-hidden rounded-md border border-black/10 bg-white dark:border-[#D5D5D5]/10 dark:bg-[#0C1222] sm:w-44"
                    >
                        <div className="aspect-[4/5] w-full bg-black/5 dark:bg-white/5" />
                        <div className="flex flex-col gap-2 p-2.5">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-black/70 dark:text-[#3BF4C7]/80">
                                <span className="block h-[1em] w-14 bg-black/10 dark:bg-white/10" />
                            </span>
                            <p className="line-clamp-2 text-xs font-semibold">
                                <span className="block h-[1em] w-full bg-black/10 dark:bg-white/10" />
                                <span className="mt-1 block h-[1em] w-2/3 bg-black/10 dark:bg-white/10" />
                            </p>
                            <div className="flex items-center gap-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60">
                                <span className="block h-[1em] w-8 bg-black/10 dark:bg-white/10" />
                                <span className="block h-[1em] w-8 bg-black/10 dark:bg-white/10" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

async function PopularCoursesSection() {
    const popular = await getUpcomingExamsCourseGrid();
    if (popular.length === 0) return null;

    return (
        <section className="flex flex-col gap-4">
            <header className="flex items-end justify-between">
                <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
                    Upcoming exams
                </h2>
            </header>
            <SmartCourseGrid
                courses={popular}
                className={COURSE_GRID_CLASS}
                page={1}
                pageSize={POPULAR_LIMIT}
                rankCourses={false}
            />
        </section>
    );
}

async function CourseGridSection({
    searchParamsPromise,
}: {
    searchParamsPromise: Promise<PastPapersSearchParams> | undefined;
}) {
    const params = (await searchParamsPromise) ?? {};
    const search = params.search?.trim() || "";
    const rawPage = Number.parseInt(params.page || "1", 10) || 1;

    const courses: CourseGridItem[] = search
        ? await searchCourseGrid(search)
        : await getCourseGrid();

    const totalPages = Math.max(1, Math.ceil(courses.length / PAGE_SIZE));
    const page = validatePage(rawPage, totalPages);
    const paginationSearchString = buildSearchString({
        search,
        page: page > 1 ? String(page) : undefined,
    });
    if (page !== rawPage) {
        const qs = new URLSearchParams();
        if (search) qs.set("search", search);
        if (page > 1) qs.set("page", String(page));
        const query = qs.toString();
        redirect(`/past_papers${query ? `?${query}` : ""}`);
    }

    if (courses.length === 0) {
        return (
            <div className="border-2 border-dashed border-black/30 p-10 text-center dark:border-[#D5D5D5]/30">
                <p className="text-sm text-black/70 dark:text-[#D5D5D5]/70">
                    {search
                        ? `No courses match "${search}".`
                        : "No courses with papers or notes yet."}
                </p>
            </div>
        );
    }

    return (
        <>
            <section className="flex flex-col gap-4">
                <header className="flex items-end justify-between gap-3">
                    <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
                        {search ? `${courses.length} match${courses.length === 1 ? "" : "es"}` : "All courses"}
                    </h2>
                    {!search && (
                        <span className="text-sm text-black/60 dark:text-[#D5D5D5]/60">
                            {courses.length} total
                        </span>
                    )}
                </header>
                <SmartCourseGrid
                    courses={courses}
                    className={COURSE_GRID_CLASS}
                    page={page}
                    pageSize={PAGE_SIZE}
                    rankCourses={!search}
                />
                {totalPages > 1 && (
                    <div className="mt-4">
                        <CoursePagination
                            basePath="/past_papers"
                            currentPage={page}
                            totalPages={totalPages}
                            searchString={paginationSearchString}
                        />
                    </div>
                )}
            </section>
        </>
    );
}

async function RecentSection() {
    const recents = await getRecentPapers(10);
    return <RecentPaperStrip items={recents} />;
}

async function UpcomingSection() {
    const upcomingExams = await getUpcomingExams(12);
    if (upcomingExams.length === 0) return null;
    return <UpcomingExamsStrip items={upcomingExams} emptyPrompt={null} />;
}

function SearchControls({
    search,
    searchable,
}: {
    search: string;
    searchable: Awaited<ReturnType<typeof getCourseSearchRecords>>;
}) {
    return (
        <div className="flex w-full items-stretch gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
                <PastPapersCourseSearch
                    courses={searchable}
                    initialQuery={search}
                />
            </div>
            <div className="shrink-0">
                <UploadButtonPaper />
            </div>
        </div>
    );
}

function SearchControlsShell() {
    return (
        <div
            className="flex w-full items-stretch gap-2 sm:gap-3"
            aria-hidden="true"
        >
            <div className="h-12 min-w-0 flex-1 border border-black/15 bg-white dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] sm:h-11" />
            <div className="h-12 w-12 shrink-0 border border-black/15 bg-white dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] sm:h-11 sm:w-11" />
        </div>
    );
}

function DynamicHomeSectionsShell() {
    return (
        <>
            <SearchControlsShell />
            <PopularCoursesShell />
            <RecentSectionShell />
        </>
    );
}

async function DynamicHomeSections({
    searchParamsPromise,
    searchable,
}: {
    searchParamsPromise: Promise<PastPapersSearchParams> | undefined;
    searchable: Awaited<ReturnType<typeof getCourseSearchRecords>>;
}) {
    const params = (await searchParamsPromise) ?? {};
    const search = params.search?.trim() || "";

    return (
        <>
            <SearchControls search={search} searchable={searchable} />

            {!search && (
                <Suspense fallback={<PopularCoursesShell />}>
                    <PopularCoursesSection />
                </Suspense>
            )}

            {search && (
                <Suspense fallback={<CourseGridSectionShell search={search} />}>
                    <CourseGridSection searchParamsPromise={searchParamsPromise} />
                </Suspense>
            )}

            {!search && (
                <Suspense fallback={<RecentSectionShell />}>
                    <RecentSection />
                </Suspense>
            )}
        </>
    );
}

export default async function PastPapersPage({
    searchParams,
}: {
    searchParams?: Promise<PastPapersSearchParams>;
}) {
    const [stats, searchable] = await Promise.all([
        getCatalogStats(),
        getCourseSearchRecords(),
    ]);
    const faq = [
        {
            question: "Where can I find VIT past papers by exam type?",
            answer: "Use the links on this page to browse CAT-1, CAT-2, FAT, quiz, and other paper collections across all indexed courses.",
        },
        {
            question: "Can I browse papers course by course?",
            answer: "Yes. The course grid on this page links directly into a canonical paper collection for each course, with additional exam filters inside the course page.",
        },
    ];

    return (
        <DirectionalTransition>
            <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <StructuredData
                    data={[
                        buildCollectionPage({
                            name: "VIT past papers",
                            description:
                                "Browse VIT past papers, previous year question papers, and course-wise paper collections on ExamCooker.",
                            path: "/past_papers",
                            keywords: DEFAULT_KEYWORDS,
                            about: "VIT past papers",
                        }),
                        buildFaqPage(faq),
                    ]}
                />
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-6 sm:gap-10 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
                    <section className="flex flex-col gap-5">
                        <h1 className="whitespace-nowrap text-[1.35rem] font-black leading-none text-black dark:text-[#D5D5D5] min-[360px]:text-[1.45rem] min-[400px]:text-2xl sm:text-5xl lg:text-6xl">
                            Every paper.{" "}
                            <GradientText>Every course.</GradientText>
                        </h1>

                        <HeroStats stats={stats} />
                    </section>

                    <Suspense fallback={<DynamicHomeSectionsShell />}>
                        <DynamicHomeSections
                            searchParamsPromise={searchParams}
                            searchable={searchable}
                        />
                    </Suspense>

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
