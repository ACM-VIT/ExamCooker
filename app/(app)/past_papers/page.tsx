import React, { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import UploadButtonPaper from "@/app/components/uploadButtonPaper";
import StructuredData from "@/app/components/seo/StructuredData";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import { GradientText } from "@/app/components/landing_page/landing";
import SmartCourseGrid from "@/app/components/past_papers/SmartCourseGrid";
import CoursePagination from "@/app/components/past_papers/CoursePagination";
import RecentPaperStrip from "@/app/components/past_papers/RecentPaperStrip";
import PastPapersCourseSearch from "@/app/components/past_papers/PastPapersCourseSearch";
import UpcomingExamsStrip from "@/app/components/past_papers/UpcomingExamsStrip";
import {
    getCatalogStats,
    getCourseGrid,
    getPopularCourseGrid,
    getRecentPapers,
    getSearchableCourses,
    searchCourseGrid,
    type CourseGridItem,
} from "@/lib/data/courseCatalog";
import { getUpcomingExams } from "@/lib/data/upcomingExams";
import {
    buildKeywords,
    DEFAULT_KEYWORDS,
} from "@/lib/seo";
import {
    buildCollectionPage,
    buildFaqPage,
} from "@/lib/structuredData";

const PAGE_SIZE = 24;
const POPULAR_LIMIT = 6;
const COURSE_GRID_CLASS = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";

function buildSearchString(params: { search?: string; page?: string }) {
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
                            className="ml-3 hidden text-black/30 dark:text-[#D5D5D5]/25 sm:inline"
                        >
                            ·
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

function HeroStatsSkeleton() {
    return (
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-x-5">
            {["courses", "papers", "notes"].map((label) => (
                <div key={label} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-1.5">
                    <div className="h-7 w-12 animate-pulse bg-black/10 dark:bg-white/10 sm:h-5" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45 dark:text-[#D5D5D5]/45 sm:text-xs">
                        {label}
                    </span>
                </div>
            ))}
        </div>
    );
}

async function HeroStatsSection() {
    const stats = await getCatalogStats();
    return <HeroStats stats={stats} />;
}

function CourseSearchSkeleton() {
    return (
        <div className="flex w-full items-stretch gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
                <div className="h-11 animate-pulse border-2 border-black/15 bg-white/40 dark:border-[#D5D5D5]/15 dark:bg-white/5" />
            </div>
            <div className="shrink-0">
                <UploadButtonPaper />
            </div>
        </div>
    );
}

async function CourseSearchSection({ search }: { search: string }) {
    const searchable = await getSearchableCourses();

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

function CourseCardsSkeleton({ count }: { count: number }) {
    return (
        <div className={COURSE_GRID_CLASS}>
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="h-32 animate-pulse border-2 border-[#5FC4E7]/50 bg-[#5FC4E7]/25 dark:border-[#ffffff]/10 dark:bg-[#ffffff]/5"
                />
            ))}
        </div>
    );
}

function PopularCoursesSkeleton() {
    return (
        <section className="flex flex-col gap-4">
            <header className="flex items-end justify-between">
                <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
                    Popular courses
                </h2>
                <span className="text-sm text-black/50 dark:text-[#D5D5D5]/50">
                    Loading
                </span>
            </header>
            <CourseCardsSkeleton count={POPULAR_LIMIT} />
        </section>
    );
}

function CourseGridSectionSkeleton({ search }: { search: string }) {
    return (
        <section className="flex flex-col gap-4">
            <header className="flex items-end justify-between gap-3">
                <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
                    {search ? "Matches" : "All courses"}
                </h2>
                {!search && (
                    <span className="text-sm text-black/50 dark:text-[#D5D5D5]/50">
                        Loading
                    </span>
                )}
            </header>
            <CourseCardsSkeleton count={PAGE_SIZE} />
            <div className="mt-4 flex justify-center">
                <div className="h-9 w-64 animate-pulse border border-black/20 bg-[#5FC4E7]/20 dark:border-[#D5D5D5]/20 dark:bg-white/5" />
            </div>
        </section>
    );
}

async function PopularCoursesSection() {
    const popular = await getPopularCourseGrid(POPULAR_LIMIT);
    if (popular.length === 0) return null;

    return (
        <section className="flex flex-col gap-4">
            <header className="flex items-end justify-between">
                <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
                    Popular courses
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
    params,
}: {
    params: { search?: string; page?: string };
}) {
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

export default async function PastPapersPage({
    searchParams,
}: {
    searchParams?: Promise<{ search?: string; page?: string }>;
}) {
    const params = (await searchParams) ?? {};
    const search = params.search || "";
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

                        <Suspense fallback={<HeroStatsSkeleton />}>
                            <HeroStatsSection />
                        </Suspense>

                        <Suspense fallback={<CourseSearchSkeleton />}>
                            <CourseSearchSection search={search} />
                        </Suspense>
                    </section>

                    {!search && (
                        <Suspense fallback={<PopularCoursesSkeleton />}>
                            <PopularCoursesSection />
                        </Suspense>
                    )}

                    <Suspense fallback={<CourseGridSectionSkeleton search={search} />}>
                        <CourseGridSection params={params} />
                    </Suspense>

                    {!search && (
                        <Suspense fallback={null}>
                            <RecentSection />
                        </Suspense>
                    )}

                    {!search && (
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
                    )}
                </div>
            </div>
        </DirectionalTransition>
    );
}
