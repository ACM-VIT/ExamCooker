import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import ResourceCard from '../../components/ResourceCard';
import Pagination from '../../components/Pagination';
import SearchBar from '../../components/SearchBar';
import { getResourcesCount, getResourcesPage } from '@/lib/data/resources';

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
                    className="h-28 bg-[#5FC4E7]/40 dark:bg-[#ffffff]/5 border-2 border-transparent animate-pulse"
                />
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
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
