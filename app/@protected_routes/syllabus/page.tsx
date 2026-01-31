import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from "next";
import SyllabusCard from '@/app/components/SyllabusCard';
import SearchBar from "../../components/SearchBar";
import Pagination from "../../components/Pagination";
import { getSyllabusCount, getSyllabusPage } from "@/lib/data/syllabus";
import { DEFAULT_KEYWORDS } from "@/lib/seo";

function validatePage(page: number, totalPages: number): number {
    if (isNaN(page) || page < 1) {
        return 1;
    }
    if (page > totalPages && totalPages > 0) {
        return totalPages;
    }
    return page;
}

function SyllabusSkeleton() {
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

async function SyllabusResults({ params }: { params: { page?: string; search?: string } }) {
    const pageSize = 16;
    const search = params.search || '';
    const page = parseInt(params.page || '1', 10);

    const totalCount = await getSyllabusCount({ search });
    const totalPages = Math.ceil(totalCount / pageSize);
    const validatedPage = validatePage(page, totalPages);
    const paginatedSyllabi = await getSyllabusPage({
        search,
        page: validatedPage,
        pageSize,
    });

    if (validatedPage !== page) {
        redirect(`/syllabus?page=${validatedPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
    }

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-[90vw]">
                {paginatedSyllabi.map((syllabus) => (
                    <SyllabusCard key={syllabus.id} syllabus={syllabus} />
                ))}
            </div>

            {totalPages > 1 && (
                <div className="mt-8 sm:mt-10 md:mt-12">
                    <Pagination
                        currentPage={validatedPage}
                        totalPages={totalPages}
                        basePath="/syllabus"
                        searchQuery={search}
                    />
                </div>
            )}
        </>
    );
}

export default async function SyllabusPage({
    searchParams,
}: {
    searchParams?: Promise<{ page?: string; search?: string }>;
}) {
    const params = (await searchParams) ?? {};
    const search = params.search || '';

    return (
        <div className="min-h-screen text-black dark:text-gray-200 flex flex-col items-center justify-start p-8">
            <h1 className="text-center mb-4">Syllabus</h1>

            <div className="w-full max-w-3xl mb-6 sm:mb-8 pt-2">
                <SearchBar pageType="syllabus" initialQuery={search} />
            </div>

            <Suspense fallback={<SyllabusSkeleton />}>
                <SyllabusResults params={params} />
            </Suspense>
        </div>
    );
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
    const title = search ? `Syllabus matching \"${search}\"` : "Syllabus";

    return {
        title,
        description: "Browse syllabus PDFs on ExamCooker.",
        keywords: DEFAULT_KEYWORDS,
        alternates: { canonical: "/syllabus" },
        robots: { index: isIndexable, follow: true },
    };
}
