import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from "next";
import ResourceCard from '../../components/ResourceCard';
import Pagination from '../../components/Pagination';
import SearchBar from '../../components/SearchBar';
import { getResourcesCount, getResourcesPage } from '@/lib/data/resources';
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

function ResourcesSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, index) => (
                <div
                    key={index}
                    className="flex flex-col justify-between w-full h-full p-4 bg-[#5FC4E7]/40 border-2 border-transparent dark:bg-[#ffffff]/5 dark:lg:bg-[#0C1222] dark:border-[#ffffff]/20 transition-all duration-200"
                >
                    <div className="space-y-2">
                        <div className="h-4 w-3/4 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                        <div className="h-3 w-1/3 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                    </div>
                    <div className="flex justify-between mt-4">
                        <div />
                        <div className="h-4 w-4 bg-black/10 dark:bg-white/10 rounded-full animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    );
}

async function ResourcesResults({ params }: { params: { page?: string; search?: string } }) {
    const pageSize = 12;
    const search = params.search || '';
    const page = parseInt(params.page || '1', 10);

    const totalCount = await getResourcesCount({ search });
    const totalPages = Math.ceil(totalCount / pageSize);
    const validatedPage = validatePage(page, totalPages);
    const paginatedSubjects = await getResourcesPage({
        search,
        page: validatedPage,
        pageSize,
    });

    if (validatedPage !== page) {
        redirect(`/resources?page=${validatedPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
    }

    return (
        <>
            {paginatedSubjects.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {paginatedSubjects.map((subject) => (
                        <ResourceCard key={subject.id} subject={subject} />
                    ))}
                </div>
            ) : (
                <p className="text-center text-lg">
                    {search
                        ? "No subjects found matching your search."
                        : "No subjects found."}
                </p>
            )}

            {totalPages > 1 && (
                <div className="mt-12">
                    <Pagination
                        currentPage={validatedPage}
                        totalPages={totalPages}
                        basePath="/resources"
                        searchQuery={search}
                    />
                </div>
            )}
        </>
    );
}

export default async function ResourcesPage({
    searchParams,
}: {
    searchParams?: Promise<{ page?: string; search?: string }>;
}) {
    const params = (await searchParams) ?? {};
    const search = params.search || '';

    return (
        <div className="transition-colors min-h-screen text-black dark:text-gray-200">
            <div className="container mx-auto px-2 sm:px-4 lg:px-8 py-2 sm:py-4 lg:py-8">
                <h1 className="text-center mb-8">Resource Repo</h1>

                <div className="max-w-3xl mx-auto mb-8">
                    <SearchBar pageType="resources" initialQuery={search} />
                </div>

                <Suspense fallback={<ResourcesSkeleton />}>
                    <ResourcesResults params={params} />
                </Suspense>
            </div>
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
    const title = search ? `Resources matching \"${search}\"` : "Resources";

    return {
        title,
        description: "Browse course resources and reference material on ExamCooker.",
        keywords: DEFAULT_KEYWORDS,
        alternates: { canonical: "/resources" },
        robots: { index: isIndexable, follow: true },
    };
}
