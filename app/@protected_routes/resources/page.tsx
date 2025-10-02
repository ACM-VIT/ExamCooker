import React from 'react';
import Fuse from 'fuse.js';
import { PrismaClient, Subject } from '@/src/generated/prisma';
import { redirect } from 'next/navigation';
import ResourceCard from '../../components/ResourceCard';
import Pagination from '../../components/Pagination';
import SearchBar from '../../components/SearchBar';

const SCORE_THRESHOLD = 0.8;
const prisma = new PrismaClient();

function validatePage(page: number, totalPages: number): number {
    if (isNaN(page) || page < 1) {
        return 1;
    }
    if (page > totalPages && totalPages > 0) {
        return totalPages;
    }
    return page;
}

function performSearch(query: string, dataSet: Subject[]) {
    const options = {
        includeScore: true,
        keys: ['name'],
        threshold: 0.6,
        ignoreLocation: true,
        minMatchCharLength: 2,
    };
    const fuse = new Fuse(dataSet, options);
    const searchResults = fuse.search(query);
    return searchResults
        .filter((fuseResult) => (fuseResult.score || 1) < SCORE_THRESHOLD)
        .map((fuseResult) => fuseResult.item);
}

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ page?: string, search?: string }> }) {
    const pageSize = 12;
    const params = await searchParams;
    const search = params.search || '';
    const page = parseInt(params.page || '1', 10);

    const allSubjects = await prisma.subject.findMany();

    let filteredSubjects = allSubjects;
    if (search) {
        filteredSubjects = performSearch(search, allSubjects);
    }

    const totalCount = filteredSubjects.length;
    const totalPages = Math.ceil(totalCount / pageSize);

    const validatedPage = validatePage(page, totalPages);

    const startIndex = (validatedPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedSubjects = filteredSubjects.slice(startIndex, endIndex);

    if (validatedPage !== page) {
        redirect(`/resources?page=${validatedPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
    }

    return (
        <div className="transition-colors min-h-screen text-black dark:text-gray-200">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-center mb-8">Resource Repo</h1>

                <div className="max-w-3xl mx-auto mb-8">
                    <SearchBar pageType="resources" initialQuery={search} />
                </div>

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
            </div>
        </div>
    );
}
