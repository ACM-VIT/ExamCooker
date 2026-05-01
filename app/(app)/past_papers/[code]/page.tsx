import React, { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { normalizeCourseCode } from "@/lib/course-tags";
import { examSlugToType } from "@/lib/exam-slug";
import { getCourseDetailByCode } from "@/lib/data/course-catalog";
import {
    getCoursePaperFilterOptions,
    getCoursePapers,
    type CoursePaperSort,
} from "@/lib/data/course-papers";
import { getSyllabusByCourseCode } from "@/lib/data/syllabus";
import StructuredData from "@/app/components/seo/structured-data";
import DirectionalTransition from "@/app/components/common/directional-transition";
import {
    buildCourseKeywordSet,
    getCoursePastPapersPath,
    getPastPaperDetailPath,
} from "@/lib/seo";
import CourseHeader from "@/app/components/past_papers/course-header";
import FilterBar from "@/app/components/past_papers/filter-bar";
import FilterSheet from "@/app/components/past_papers/filter-sheet";
import AnswerKeyButton from "@/app/components/past_papers/answer-key-button";
import SortDropdown from "@/app/components/past_papers/sort-dropdown";
import AnswerKeyToggle from "@/app/components/past_papers/answer-key-toggle";
import CoursePaperGrid from "@/app/components/past_papers/course-paper-grid";
import CoursePagination from "@/app/components/past_papers/course-pagination";
import CourseVisitTracker from "@/app/components/past_papers/course-visit-tracker";
import {
    campusValues,
    course as courseTable,
    db,
    pastPaper,
    semesterValues,
    type Campus,
    type ExamType,
    type Semester,
} from "@/db";
import {
    buildBreadcrumbList,
    buildCollectionPage,
    buildFaqPage,
    buildItemList,
} from "@/lib/structured-data";

const PAGE_SIZE = 24;
const CUID_REGEX = /^c[a-z0-9]{20,}$/i;
const SEMESTER_VALUES = new Set<Semester>(semesterValues);
const CAMPUS_VALUES = new Set<Campus>(campusValues);

type SearchParamsRaw = {
    exam?: string;
    slot?: string;
    year?: string;
    semester?: string;
    campus?: string;
    answer_key?: string;
    sort?: string;
    page?: string;
};

type ParsedFilters = {
    examTypes: ExamType[];
    slots: string[];
    years: number[];
    semesters: Semester[];
    campuses: Campus[];
    hasAnswerKey: boolean;
    sort: CoursePaperSort;
    page: number;
};

function splitList(raw: string | undefined): string[] {
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseUppercaseEnumList<T extends string>(
    raw: string | undefined,
    allowed: ReadonlySet<T>,
): T[] {
    return splitList(raw)
        .map((value) => value.toUpperCase())
        .filter((value): value is T => allowed.has(value as T));
}

function parseSearchParams(raw: SearchParamsRaw): ParsedFilters {
    const sortParam = raw.sort?.toLowerCase();
    const sort: CoursePaperSort =
        sortParam === "year_asc" || sortParam === "recent" ? sortParam : "year_desc";
    const page = Math.max(1, Number.parseInt(raw.page || "1", 10) || 1);

    return {
        examTypes: splitList(raw.exam)
            .map((s) => examSlugToType(s))
            .filter((v): v is ExamType => v !== null),
        slots: splitList(raw.slot).map((s) => s.toUpperCase()),
        years: splitList(raw.year).map((y) => Number(y)).filter((y) => !Number.isNaN(y)),
        semesters: parseUppercaseEnumList(raw.semester, SEMESTER_VALUES),
        campuses: parseUppercaseEnumList(raw.campus, CAMPUS_VALUES),
        hasAnswerKey: raw.answer_key === "1",
        sort,
        page,
    };
}

function buildSearchString(raw: SearchParamsRaw): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(raw)) {
        if (value) {
            searchParams.set(key, value);
        }
    }

    return searchParams.toString();
}

/**
 * Legacy `/past_papers/<cuid>` URLs redirect to the new canonical
 * `/past_papers/<code>/paper/<cuid>`.
 */
async function handleLegacyPaperRedirect(rawCode: string): Promise<never | void> {
    if (!CUID_REGEX.test(rawCode)) return;
    const rows = await db
        .select({
            id: pastPaper.id,
            courseCode: courseTable.code,
        })
        .from(pastPaper)
        .leftJoin(courseTable, eq(pastPaper.courseId, courseTable.id))
        .where(eq(pastPaper.id, rawCode))
        .limit(1);

    const paper = rows[0];
    if (!paper) notFound();
    const courseCode = paper.courseCode ?? "unassigned";
    permanentRedirect(
        `/past_papers/${encodeURIComponent(courseCode)}/paper/${paper.id}`,
    );
}

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ code: string }>;
    searchParams?: Promise<SearchParamsRaw>;
}): Promise<Metadata> {
    const { code } = await params;
    if (CUID_REGEX.test(code))
        return { robots: { index: false, follow: true } };

    const normalized = normalizeCourseCode(code);
    const course = await getCourseDetailByCode(normalized);
    if (!course) return { robots: { index: false, follow: true } };

    const raw = (await searchParams) ?? {};
    const filters = parseSearchParams(raw);
    const searchString = buildSearchString(raw);
    const hasFilters =
        filters.examTypes.length > 0 ||
        filters.slots.length > 0 ||
        filters.years.length > 0 ||
        filters.semesters.length > 0 ||
        filters.campuses.length > 0 ||
        filters.hasAnswerKey;

    const title = `${course.title} (${course.code}) past papers`;
    const description = `Browse ${course.paperCount} past papers and ${course.noteCount} notes for ${course.title} on ExamCooker.`;

    return {
        title,
        description,
        keywords: buildCourseKeywordSet({
            code: course.code,
            title: course.title,
            aliases: course.aliases,
            intents: [
                "past papers",
                "previous year question papers",
                "pyq",
                "question papers pdf",
                "exam papers",
            ],
        }),
        alternates: { canonical: getCoursePastPapersPath(course.code) },
        robots: { index: !hasFilters && filters.page === 1, follow: true },
        openGraph: {
            title,
            description,
            url: getCoursePastPapersPath(course.code),
        },
    };
}

const SHELL_EXAM_TABS = [
    { labelW: "w-6", countW: "w-5" },
    { labelW: "w-12", countW: "w-4" },
    { labelW: "w-12", countW: "w-4" },
    { labelW: "w-10", countW: "w-3" },
    { labelW: "w-10", countW: "w-4" },
];

const SHELL_YEAR_CHIPS = Array.from({ length: 6 }).map(() => ({
    labelW: "w-9",
    countW: "w-4",
}));

const SHELL_SLOT_CHIPS = Array.from({ length: 6 }).map(() => ({
    labelW: "w-6",
    countW: "w-4",
}));

function ShellChip({
    labelW,
    countW,
}: {
    labelW: string;
    countW?: string;
}) {
    return (
        <div className="inline-flex h-9 shrink-0 items-center gap-1.5 border border-black/15 bg-white px-3 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]">
            <span className={`h-3 ${labelW} bg-black/15 dark:bg-white/15`} />
            {countW && (
                <span className={`h-3 ${countW} bg-black/10 dark:bg-white/10`} />
            )}
        </div>
    );
}

function CoursePastPapersSectionsShell() {
    return (
        <>
            <section className="flex flex-col gap-2" aria-hidden="true">
                {/* Mobile: Filters button + Key button + result count */}
                <div className="flex items-center justify-between gap-2 sm:hidden">
                    <div className="flex items-center gap-2">
                        <div className="inline-flex h-10 items-center gap-2 border border-black/15 bg-white px-3.5 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]">
                            <span className="h-4 w-4 bg-black/15 dark:bg-white/15" />
                            <span className="h-3 w-12 bg-black/15 dark:bg-white/15" />
                        </div>
                        <div className="inline-flex h-10 items-center gap-2 border border-black/15 bg-white px-3.5 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]">
                            <span className="h-3.5 w-3.5 bg-black/15 dark:bg-white/15" />
                            <span className="h-3 w-6 bg-black/15 dark:bg-white/15" />
                        </div>
                    </div>
                    <span className="h-3 w-20 bg-black/10 dark:bg-white/10" />
                </div>

                {/* Desktop: stacked chip rows + bottom toolbar */}
                <div className="hidden flex-col gap-1.5 sm:flex">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {SHELL_EXAM_TABS.map((chip, i) => (
                            <ShellChip
                                key={`exam-${i}`}
                                labelW={chip.labelW}
                                countW={chip.countW}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {SHELL_YEAR_CHIPS.map((chip, i) => (
                            <ShellChip
                                key={`year-${i}`}
                                labelW={chip.labelW}
                                countW={chip.countW}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {SHELL_SLOT_CHIPS.map((chip, i) => (
                            <ShellChip
                                key={`slot-${i}`}
                                labelW={chip.labelW}
                                countW={chip.countW}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3 dark:border-[#D5D5D5]/10">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="inline-flex items-center gap-2">
                                <span className="h-3 w-20 bg-black/15 dark:bg-white/15" />
                                <span className="h-4 w-4 border border-black/30 bg-white dark:border-[#D5D5D5]/30 dark:bg-[#0C1222]" />
                            </div>
                            <div className="inline-flex items-center gap-2">
                                <span className="h-3 w-8 bg-black/15 dark:bg-white/15" />
                                <span className="h-7 w-36 border border-black/25 bg-white dark:border-[#D5D5D5]/25 dark:bg-[#0C1222]" />
                            </div>
                        </div>
                        <span className="h-3 w-24 bg-black/10 dark:bg-white/10" />
                    </div>
                </div>
            </section>

            <div className="flex flex-wrap gap-3" aria-hidden="true">
                {Array.from({ length: 10 }).map((_, index) => (
                    <div
                        key={index}
                        className="min-w-0 basis-[calc((100%-0.75rem)/2)] sm:basis-[calc((100%-1.5rem)/3)] lg:basis-[calc((100%-2.25rem)/4)] xl:basis-[calc((100%-3rem)/5)]"
                    >
                        <div className="flex h-full flex-col border-2 border-[#5FC4E7] bg-[#5FC4E7] p-3 text-black dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222]">
                            <div className="flex flex-col gap-1.5 pb-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="inline-flex h-[18px] w-12 items-center bg-black/10 dark:bg-[#D5D5D5]/15" />
                                    <span className="inline-flex h-[18px] w-10 items-center bg-black/10 dark:bg-[#D5D5D5]/15" />
                                    <span className="inline-flex h-[13px] w-8 items-center bg-black/10 dark:bg-[#D5D5D5]/10" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="h-[14px] w-full bg-black/10 dark:bg-[#D5D5D5]/15" />
                                    <span className="h-[14px] w-3/5 bg-black/10 dark:bg-[#D5D5D5]/15" />
                                </div>
                            </div>
                            <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#d9d9d9] dark:bg-white/5" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex justify-center" aria-hidden="true">
                <nav className="flex flex-wrap items-center justify-center gap-1">
                    {["‹", "1", "2", "3", "4", "›"].map((label, index) => (
                        <span
                            key={`${label}-${index}`}
                            className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center border px-3 text-sm font-semibold ${
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
        </>
    );
}

async function CoursePastPapersContent({
    course,
    searchParamsPromise,
}: {
    course: NonNullable<Awaited<ReturnType<typeof getCourseDetailByCode>>>;
    searchParamsPromise: Promise<SearchParamsRaw> | undefined;
}) {
    const raw = (await searchParamsPromise) ?? {};
    const filters = parseSearchParams(raw);
    const searchString = buildSearchString(raw);
    const basePath = getCoursePastPapersPath(course.code);
    const [options, { papers, totalCount }] = await Promise.all([
        getCoursePaperFilterOptions(course.id),
        getCoursePapers({
            courseId: course.id,
            filters: {
                examTypes: filters.examTypes,
                slots: filters.slots,
                years: filters.years,
                semesters: filters.semesters,
                campuses: filters.campuses,
                hasAnswerKey: filters.hasAnswerKey || undefined,
            },
            sort: filters.sort,
            page: filters.page,
            pageSize: PAGE_SIZE,
        }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    if (filters.page > totalPages) {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries(raw)) {
            if (k !== "page" && v) next.set(k, Array.isArray(v) ? v.join(",") : v);
        }
        const qs = next.toString();
        redirect(
            qs
                ? `/past_papers/${course.code}?${qs}`
                : `/past_papers/${course.code}`,
        );
    }

    return (
        <>
            <StructuredData
                data={[
                    buildItemList(
                        papers.map((paper) => ({
                            name: paper.title,
                            path: getPastPaperDetailPath(paper.id, course.code),
                        })),
                    ),
                ]}
            />

            <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 sm:hidden">
                    <div className="flex items-center gap-2">
                        <FilterSheet
                            basePath={basePath}
                            options={options}
                            examCounts={options.examCounts}
                            yearCounts={options.yearCounts}
                            slotCounts={options.slotCounts}
                            searchString={searchString}
                            totalCount={totalCount}
                        />
                        <AnswerKeyButton
                            basePath={basePath}
                            count={options.answerKeyCount}
                            searchString={searchString}
                        />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
                        {totalCount} result{totalCount === 1 ? "" : "s"}
                    </p>
                </div>

                <div className="hidden flex-col gap-2 sm:flex sm:gap-1.5">
                    <FilterBar
                        basePath={basePath}
                        options={options}
                        examCounts={options.examCounts}
                        yearCounts={options.yearCounts}
                        slotCounts={options.slotCounts}
                        searchString={searchString}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3 dark:border-[#D5D5D5]/10">
                        <div className="flex flex-wrap items-center gap-3">
                            <AnswerKeyToggle
                                basePath={basePath}
                                count={options.answerKeyCount}
                                searchString={searchString}
                            />
                            <SortDropdown
                                basePath={basePath}
                                value={filters.sort}
                                searchString={searchString}
                            />
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
                            {totalCount} result{totalCount === 1 ? "" : "s"}
                        </p>
                    </div>
                </div>
            </section>

            {papers.length === 0 ? (
                <div className="border border-dashed border-black/20 p-10 text-center dark:border-[#D5D5D5]/20">
                    <p className="text-sm text-black/70 dark:text-[#D5D5D5]/70">
                        No papers match the current filters.
                    </p>
                    <Link
                        href={`/past_papers/${course.code}`}
                        transitionTypes={["nav-back"]}
                        className="mt-3 inline-block text-sm font-semibold text-black underline underline-offset-2 hover:text-black dark:text-[#D5D5D5] dark:hover:text-[#D5D5D5]"
                    >
                        Clear filters
                    </Link>
                </div>
            ) : (
                <CoursePaperGrid
                    papers={papers}
                    courseCode={course.code}
                    courseTitle={course.title}
                />
            )}

            {totalPages > 1 && (
                <div className="mt-4">
                    <CoursePagination
                        basePath={basePath}
                        currentPage={filters.page}
                        totalPages={totalPages}
                        searchString={searchString}
                    />
                </div>
            )}
        </>
    );
}

function CoursePastPapersHeaderShell() {
    return (
        <div
            className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-6 sm:px-6 lg:px-10 lg:py-10"
            aria-hidden="true"
        >
            <header className="flex flex-col gap-4">
                <span className="h-3 w-32 bg-black/10 dark:bg-white/10" />
                <span className="h-9 w-2/3 bg-black/10 dark:bg-white/10 sm:h-10 lg:h-12" />
            </header>
            <CoursePastPapersSectionsShell />
        </div>
    );
}

async function CoursePastPapersPageContent({
    paramsPromise,
    searchParamsPromise,
}: {
    paramsPromise: Promise<{ code: string }>;
    searchParamsPromise: Promise<SearchParamsRaw> | undefined;
}) {
    const { code } = await paramsPromise;

    await handleLegacyPaperRedirect(code);

    const normalized = normalizeCourseCode(code);
    if (!normalized) notFound();

    const course = await getCourseDetailByCode(normalized);
    if (!course) notFound();

    const syllabus = await getSyllabusByCourseCode(course.code);

    const description = `Browse ${course.paperCount} past papers and ${course.noteCount} notes for ${course.title} on ExamCooker.`;
    const faq = [
        {
            question: `Where can I find ${course.code} past papers?`,
            answer: `This page is the canonical paper collection for ${course.code}. It groups all indexed papers for ${course.title} and exposes structured filters for exam type, slot, year, semester, campus, and answer keys.`,
        },
        {
            question: `Does ${course.code} also have notes and syllabus links?`,
            answer: `Yes. Use the sibling notes, syllabus, and resource routes linked from this page to move between revision material and past paper practice.`,
        },
    ];

    return (
        <>
            <CourseVisitTracker code={course.code} />
            <StructuredData
                data={[
                    buildBreadcrumbList([
                        { name: "Past papers", path: "/past_papers" },
                        {
                            name: course.title,
                            path: getCoursePastPapersPath(course.code),
                        },
                    ]),
                    buildCollectionPage({
                        name: `${course.code} past papers`,
                        description,
                        path: getCoursePastPapersPath(course.code),
                        about: course.title,
                    }),
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

                <Suspense fallback={<CoursePastPapersSectionsShell />}>
                    <CoursePastPapersContent
                        course={course}
                        searchParamsPromise={searchParamsPromise}
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
        </>
    );
}

export default function CoursePastPapersPage({
    params,
    searchParams,
}: {
    params: Promise<{ code: string }>;
    searchParams?: Promise<SearchParamsRaw>;
}) {
    return (
        <DirectionalTransition>
            <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <Suspense fallback={<CoursePastPapersHeaderShell />}>
                    <CoursePastPapersPageContent
                        paramsPromise={params}
                        searchParamsPromise={searchParams}
                    />
                </Suspense>
            </div>
        </DirectionalTransition>
    );
}
