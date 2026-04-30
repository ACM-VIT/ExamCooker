import { Suspense } from "react";
import type { Metadata } from "next";
import DirectionalTransition from "@/app/components/common/directional-transition";
import ResourceBrowser from "@/app/components/resources/resource-browser";
import { GradientText } from "@/app/components/landing_page/landing";
import { DEFAULT_KEYWORDS } from "@/lib/seo";
import { getVinCatalogMeta, getVinCourses, getVinYears } from "@/lib/data/vin-together";

type ResourcesSearchParams = { search?: string; year?: string };

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

function ResourceBrowserShell() {
    return (
        <div className="flex flex-col gap-4" aria-hidden="true">
            <div className="flex items-stretch gap-2 sm:gap-3">
                <div className="h-12 min-w-0 flex-1 border border-black/25 bg-white dark:border-[#D5D5D5]/30 dark:bg-[#3D414E]" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                    <span
                        key={index}
                        className="inline-flex h-9 w-16 border-2 border-black/15 bg-white dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]"
                    />
                ))}
            </div>
            <div className="flex flex-col gap-4 pt-2">
                <span className="h-5 w-32 bg-black/10 dark:bg-white/10" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <div
                            key={index}
                            className="flex h-full flex-col gap-3 border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:lg:bg-[#0C1222]"
                        >
                            <span className="block h-3 w-20 bg-black/10 dark:bg-white/10" />
                            <span className="block h-4 w-full bg-black/10 dark:bg-white/10" />
                            <span className="block h-4 w-3/5 bg-black/10 dark:bg-white/10" />
                            <div className="mt-auto flex items-end gap-1 pt-1">
                                <span className="block h-7 w-10 bg-black/10 dark:bg-white/10" />
                                <span className="block h-3 w-12 bg-black/10 dark:bg-white/10" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

async function ResourceBrowserSection({
    searchParamsPromise,
}: {
    searchParamsPromise: Promise<ResourcesSearchParams> | undefined;
}) {
    const params = (await searchParamsPromise) ?? {};
    const search = params.search?.trim() ?? "";
    const year = params.year?.trim() ?? "";
    const years = getVinYears();
    const meta = getVinCatalogMeta();
    const courseCards = getVinCourses().map((course) => ({
        id: course.id,
        slug: course.slug,
        displayName: course.displayName,
        shortName: course.shortName,
        year: course.year,
        image: course.image,
        counts: course.counts,
        matchKeys: course.matchKeys,
    }));

    return (
        <ResourceBrowser
            courses={courseCards}
            initialSearch={search}
            initialYear={year}
            years={years}
            sourceUrl={meta.source.coursesUrl}
        />
    );
}

export default async function ResourcesPage({
    searchParams,
}: {
    searchParams?: Promise<ResourcesSearchParams>;
}) {
    const meta = getVinCatalogMeta();

    return (
        <DirectionalTransition>
            <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-6 sm:gap-10 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
                    <section className="flex flex-col gap-5">
                        <h1 className="whitespace-nowrap text-[1.35rem] font-black leading-none text-black dark:text-[#D5D5D5] min-[360px]:text-[1.45rem] min-[400px]:text-2xl sm:text-5xl lg:text-6xl">
                            Resource{" "}
                            <GradientText>Repository</GradientText>
                        </h1>

                        <HeroStats stats={meta.counts} />

                        <Suspense fallback={<ResourceBrowserShell />}>
                            <ResourceBrowserSection searchParamsPromise={searchParams} />
                        </Suspense>
                    </section>
                </div>
            </div>
        </DirectionalTransition>
    );
}

export async function generateMetadata({
    searchParams,
}: {
    searchParams?: Promise<ResourcesSearchParams>;
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
            "Browse ExamCooker's structured course resources with module-wise videos, notes, PDFs, and previous questions.",
        keywords: DEFAULT_KEYWORDS,
        alternates: { canonical: "/resources" },
        robots: { index: isIndexable, follow: true },
    };
}
