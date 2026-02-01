import React, { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Pagination from "@/app/components/Pagination";
import SearchBar from "@/app/components/SearchBar";
import { getCourseCatalog } from "@/lib/data/courses";
import { DEFAULT_KEYWORDS } from "@/lib/seo";
import CourseCard from "@/app/components/CourseCard";

const PAGE_SIZE = 16;

function validatePage(page: number, totalPages: number): number {
    if (Number.isNaN(page) || page < 1) return 1;
    if (page > totalPages && totalPages > 0) return totalPages;
    return page;
}

export async function generateMetadata({
    searchParams,
}: {
    searchParams?: Promise<{ page?: string; search?: string }>;
}): Promise<Metadata> {
    const params = (await searchParams) ?? {};
    const search = params.search || "";
    const page = Number.parseInt(params.page || "1", 10) || 1;
    const isIndexable = !search && page <= 1;
    const title = search ? `Courses matching "${search}"` : "Courses";

    return {
        title,
        description: "Browse ExamCooker course pages built from verified course tags.",
        keywords: DEFAULT_KEYWORDS,
        alternates: { canonical: "/courses" },
        robots: { index: isIndexable, follow: true },
    };
}

function CoursesSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-[90vw]">
            {Array.from({ length: 16 }).map((_, index) => (
                <div
                    key={index}
                    className="flex flex-col justify-start w-full h-full p-4 bg-[#5FC4E7]/40 border-2 border-transparent dark:bg-[#ffffff]/5 dark:lg:bg-[#0C1222] dark:border-[#ffffff]/20 transition-all duration-200"
                >
                    <div className="h-4 w-3/4 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-1/3 bg-black/10 dark:bg-white/10 rounded animate-pulse mt-2" />
                </div>
            ))}
        </div>
    );
}

async function CoursesResults({ params }: { params: { page?: string; search?: string } }) {
    const search = params.search?.trim() || "";
    const page = Number.parseInt(params.page || "1", 10) || 1;

    const courses = await getCourseCatalog();
    const filtered = search
        ? courses.filter((course) => {
              const haystack = `${course.code} ${course.title}`.toLowerCase();
              return haystack.includes(search.toLowerCase());
          })
        : courses;

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
    const validatedPage = validatePage(page, totalPages);

    if (validatedPage !== page) {
        redirect(`/courses?page=${validatedPage}${search ? `&search=${encodeURIComponent(search)}` : ""}`);
    }

    const sliceStart = (validatedPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(sliceStart, sliceStart + PAGE_SIZE);

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-[90vw]">
                {pageItems.map((course) => (
                    <CourseCard key={course.code} course={course} />
                ))}
            </div>

            {totalPages > 1 && (
                <div className="mt-8 sm:mt-10 md:mt-12">
                    <Pagination
                        currentPage={validatedPage}
                        totalPages={totalPages}
                        basePath="/courses"
                        searchQuery={search}
                    />
                </div>
            )}
        </>
    );
}

export default async function CoursesPage({
    searchParams,
}: {
    searchParams?: Promise<{ page?: string; search?: string }>;
}) {
    const params = (await searchParams) ?? {};
    const search = params.search || "";

    return (
        <div className="min-h-screen text-black dark:text-gray-200 flex flex-col items-center justify-start p-2 sm:p-4 lg:p-8">
            <h1 className="text-center mb-4">Courses</h1>

            <div className="w-full max-w-3xl mb-6 sm:mb-8 pt-2">
                <SearchBar pageType="courses" initialQuery={search} />
            </div>

            <Suspense fallback={<CoursesSkeleton />}>
                <CoursesResults params={params} />
            </Suspense>
        </div>
    );
}
