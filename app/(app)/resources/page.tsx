import type { Metadata } from "next";
import { ViewTransition } from "react";
import { ArrowUpRight } from "lucide-react";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import ResourceFilters from "@/app/components/resources/ResourceFilters";
import ResourceCourseCard from "@/app/components/resources/ResourceCourseCard";
import { GradientText } from "@/app/components/landing_page/landing";
import { DEFAULT_KEYWORDS } from "@/lib/seo";
import { getVinCatalogMeta, getVinCourses, getVinYears } from "@/lib/data/vinTogether";

function formatCount(value: number) {
    return Intl.NumberFormat("en-IN").format(value);
}

function HeroStats({
    stats,
}: {
    stats: { courseCount: number; moduleCount: number; videoCount: number; questionCount: number };
}) {
    const items = [
        { label: "courses", value: stats.courseCount },
        { label: "modules", value: stats.moduleCount },
        { label: "videos", value: stats.videoCount },
        { label: "questions", value: stats.questionCount },
    ];
    return (
        <div className="grid grid-cols-4 gap-2 text-black/70 dark:text-[#D5D5D5]/70 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-5 sm:gap-y-1">
            {items.map((item, idx) => (
                <div
                    key={item.label}
                    className="flex min-w-0 flex-col items-start gap-0.5 text-left sm:flex-row sm:items-baseline sm:gap-1.5"
                >
                    <span className="text-[1.7rem] font-black leading-none text-black dark:text-[#D5D5D5] sm:text-xl">
                        {formatCount(item.value)}
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

export default async function ResourcesPage({
    searchParams,
}: {
    searchParams?: Promise<{ search?: string; year?: string }>;
}) {
    const params = (await searchParams) ?? {};
    const search = params.search?.trim() ?? "";
    const year = params.year?.trim() ?? "";
    const courses = getVinCourses({ search, year });
    const courseCards = courses.map((course) => ({
        id: course.id,
        slug: course.slug,
        displayName: course.displayName,
        shortName: course.shortName,
        year: course.year,
        image: course.image,
        counts: course.counts,
    }));
    const years = getVinYears();
    const meta = getVinCatalogMeta();

    return (
        <DirectionalTransition>
            <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-6 sm:gap-10 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
                    {/* Hero */}
                    <section className="flex flex-col gap-5">
                        <h1 className="whitespace-nowrap text-[1.35rem] font-black leading-none text-black dark:text-[#D5D5D5] min-[360px]:text-[1.45rem] min-[400px]:text-2xl sm:text-5xl lg:text-6xl">
                            Resource{" "}
                            <GradientText>Repository</GradientText>
                        </h1>

                        <HeroStats stats={meta.counts} />

                        <div className="flex w-full items-stretch gap-2 sm:gap-3">
                            <div className="min-w-0 flex-1">
                                <ResourceFilters
                                    key={`${search}:${year}`}
                                    initialSearch={search}
                                    initialYear={year}
                                    years={years}
                                />
                            </div>
                            <div className="group relative inline-flex h-12 shrink-0 items-stretch">
                                <div className="absolute inset-0 dark:bg-[#3BF4C7]" />
                                <div className="absolute inset-0 blur-[60px] bg-[#82BEE9] opacity-0 transition duration-200 group-hover:opacity-25 dark:hidden" />
                                <div className="dark:absolute dark:inset-0 dark:blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
                                <a
                                    href={meta.source.coursesUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="relative inline-flex h-full items-center gap-1.5 border-2 border-black bg-[#82BEE9] px-4 text-sm font-bold text-black transition duration-150 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7] dark:group-hover:-translate-x-0.5 dark:group-hover:-translate-y-0.5"
                                >
                                    Source
                                    <ArrowUpRight className="h-4 w-4" />
                                </a>
                            </div>
                        </div>
                    </section>

                    {courseCards.length > 0 ? (
                        <section className="flex flex-col gap-4">
                            <header>
                                <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
                                    {search || year ? `${courseCards.length} match${courseCards.length === 1 ? "" : "es"}` : "All courses"}
                                </h2>
                            </header>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {courseCards.map((course) => (
                                    <ViewTransition key={course.id}>
                                        <ResourceCourseCard course={course} />
                                    </ViewTransition>
                                ))}
                            </div>
                        </section>
                    ) : (
                        <div className="border-2 border-dashed border-black/30 p-10 text-center dark:border-[#D5D5D5]/30">
                            <p className="text-sm text-black/70 dark:text-[#D5D5D5]/70">
                                {search || year
                                    ? `No courses match those filters.`
                                    : "No courses with resources yet."}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </DirectionalTransition>
    );
}

export async function generateMetadata({
    searchParams,
}: {
    searchParams?: Promise<{ search?: string; year?: string }>;
}): Promise<Metadata> {
    const params = (await searchParams) ?? {};
    const search = params.search?.trim() ?? "";
    const year = params.year?.trim() ?? "";
    const isIndexable = !search && !year;
    const titleParts = ["Resources"];

    if (year) {
        titleParts.push(year);
    }

    if (search) {
        titleParts.push(`matching "${search}"`);
    }

    return {
        title: titleParts.join(" | "),
        description:
            "Browse ExamCooker's structured VInTogether course resources with module-wise videos, notes, PDFs, and previous questions.",
        keywords: DEFAULT_KEYWORDS,
        alternates: { canonical: "/resources" },
        robots: { index: isIndexable, follow: true },
    };
}
