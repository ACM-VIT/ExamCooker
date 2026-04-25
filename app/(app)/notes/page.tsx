import React, { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ViewTransition } from "react";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import { GradientText } from "@/app/components/landing_page/landing";
import NotesCourseGridCard from "@/app/components/notes/NotesCourseGridCard";
import NotesCourseSearch from "@/app/components/notes/NotesCourseSearch";
import UploadButtonNotes from "@/app/components/UploadButtonNotes";
import {
    getNotesCourseGrid,
    getNotesStats,
    getSearchableNoteCourses,
    searchNotesCourseGrid,
    type NotesCourseGridItem,
} from "@/lib/data/notes";
import { buildKeywords, DEFAULT_KEYWORDS } from "@/lib/seo";

const PAGE_SIZE = 24;
const POPULAR_LIMIT = 6;
const COURSE_GRID_CLASS =
    "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";

function formatNumber(n: number) {
    return n.toLocaleString("en-US");
}

function HeroStats({
    stats,
}: {
    stats: { noteCount: number; courseCount: number };
}) {
    const items = [
        { label: "notes", value: stats.noteCount },
        { label: "courses", value: stats.courseCount },
    ];
    return (
        <div className="grid grid-cols-2 gap-2 text-black/70 dark:text-[#D5D5D5]/70 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-5 sm:gap-y-1">
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

function CourseGridSkeleton() {
    return (
        <div className={COURSE_GRID_CLASS}>
            {Array.from({ length: 18 }).map((_, i) => (
                <div
                    key={i}
                    className="h-32 animate-pulse border-2 border-[#5FC4E7]/50 bg-[#5FC4E7]/25 dark:border-[#ffffff]/10 dark:bg-[#ffffff]/5"
                />
            ))}
        </div>
    );
}

function validatePage(page: number, totalPages: number): number {
    if (Number.isNaN(page) || page < 1) return 1;
    if (totalPages > 0 && page > totalPages) return totalPages;
    return page;
}

async function CourseGridSection({
    params,
}: {
    params: { search?: string; page?: string };
}) {
    const search = params.search?.trim() || "";
    const rawPage = Number.parseInt(params.page || "1", 10) || 1;

    const courses: NotesCourseGridItem[] = search
        ? await searchNotesCourseGrid(search)
        : await getNotesCourseGrid();

    let popular: NotesCourseGridItem[] = [];
    let rest = courses;
    if (!search) {
        popular = [...courses]
            .sort((a, b) => b.noteCount - a.noteCount)
            .slice(0, POPULAR_LIMIT);
        const popularIds = new Set(popular.map((c) => c.id));
        rest = courses.filter((c) => !popularIds.has(c.id));
    }

    const totalPages = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
    const page = validatePage(rawPage, totalPages);
    if (page !== rawPage) {
        const qs = new URLSearchParams();
        if (search) qs.set("search", search);
        if (page > 1) qs.set("page", String(page));
        const query = qs.toString();
        redirect(`/notes${query ? `?${query}` : ""}`);
    }

    const start = (page - 1) * PAGE_SIZE;
    const slice = rest.slice(start, start + PAGE_SIZE);

    if (courses.length === 0) {
        return (
            <div className="border-2 border-dashed border-black/30 p-10 text-center dark:border-[#D5D5D5]/30">
                <p className="text-sm text-black/70 dark:text-[#D5D5D5]/70">
                    {search
                        ? `No courses match "${search}".`
                        : "No courses with notes yet."}
                </p>
            </div>
        );
    }

    return (
        <>
            {page === 1 && popular.length > 0 && (
                <section className="flex flex-col gap-4">
                    <header className="flex items-end justify-between">
                        <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
                            Popular courses
                        </h2>
                    </header>
                    <div className={COURSE_GRID_CLASS}>
                        {popular.map((course) => (
                            <ViewTransition key={course.id}>
                                <NotesCourseGridCard course={course} />
                            </ViewTransition>
                        ))}
                    </div>
                </section>
            )}

            <section className="flex flex-col gap-4">
                <header className="flex items-end justify-between gap-3">
                    <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
                        {search
                            ? `${courses.length} match${courses.length === 1 ? "" : "es"}`
                            : "All courses"}
                    </h2>
                    {!search && (
                        <span className="text-sm text-black/60 dark:text-[#D5D5D5]/60">
                            {rest.length} more
                        </span>
                    )}
                </header>
                <div className={COURSE_GRID_CLASS}>
                    {slice.map((course) => (
                        <ViewTransition key={course.id}>
                            <NotesCourseGridCard course={course} />
                        </ViewTransition>
                    ))}
                </div>
                {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                        {page > 1 && (
                            <Link
                                href={`/notes?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                                transitionTypes={["nav-back"]}
                                className="inline-flex h-9 items-center border-2 border-[#5FC4E7] bg-[#5FC4E7]/40 px-3 text-sm font-semibold transition hover:bg-[#5FC4E7]/60 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/15"
                            >
                                ← Prev
                            </Link>
                        )}
                        <span className="text-sm text-black/60 dark:text-[#D5D5D5]/60">
                            {page} / {totalPages}
                        </span>
                        {page < totalPages && (
                            <Link
                                href={`/notes?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                                transitionTypes={["nav-forward"]}
                                className="inline-flex h-9 items-center border-2 border-[#5FC4E7] bg-[#5FC4E7]/40 px-3 text-sm font-semibold transition hover:bg-[#5FC4E7]/60 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/15"
                            >
                                Next →
                            </Link>
                        )}
                    </div>
                )}
            </section>
        </>
    );
}

export default async function NotesPage({
    searchParams,
}: {
    searchParams?: Promise<{ page?: string; search?: string }>;
}) {
    const params = (await searchParams) ?? {};
    const search = params.search || "";

    const [stats, searchable] = await Promise.all([
        getNotesStats(),
        getSearchableNoteCourses(),
    ]);

    return (
        <DirectionalTransition>
            <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-6 sm:gap-10 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
                    <section className="flex flex-col gap-5">
                        <h1 className="whitespace-nowrap text-[1.35rem] font-black leading-none text-black dark:text-[#D5D5D5] min-[360px]:text-[1.45rem] min-[400px]:text-2xl sm:text-5xl lg:text-6xl">
                            Every note.{" "}
                            <GradientText>Every course.</GradientText>
                        </h1>

                        <HeroStats stats={stats} />

                        <div className="flex w-full items-stretch gap-2 sm:gap-3">
                            <div className="min-w-0 flex-1">
                                <NotesCourseSearch
                                    courses={searchable}
                                    initialQuery={search}
                                />
                            </div>
                            <div className="shrink-0">
                                <UploadButtonNotes />
                            </div>
                        </div>
                    </section>

                    <Suspense fallback={<CourseGridSkeleton />}>
                        <CourseGridSection params={params} />
                    </Suspense>
                </div>
            </div>
        </DirectionalTransition>
    );
}

export async function generateMetadata({
    searchParams,
}: {
    searchParams?: Promise<{ page?: string; search?: string }>;
}): Promise<Metadata> {
    const params = (await searchParams) ?? {};
    const search = params.search?.trim() || "";
    const page = Number.parseInt(params.page || "1", 10) || 1;
    const isIndexable = !search && page <= 1;
    const title = search ? `Notes matching "${search}"` : "Notes";
    const description = search
        ? `Courses matching ${search} on ExamCooker.`
        : "Browse VIT notes by course on ExamCooker. Find lecture notes, study material, and revision PDFs for every course.";

    return {
        title,
        description,
        keywords: buildKeywords(DEFAULT_KEYWORDS, search ? [search] : []),
        alternates: { canonical: "/notes" },
        robots: { index: isIndexable, follow: true },
    };
}
