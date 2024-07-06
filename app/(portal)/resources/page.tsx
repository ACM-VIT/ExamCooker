import React from 'react';
import Fuse from 'fuse.js';
import { PrismaClient, Prisma, Subject } from '@prisma/client';
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

export default async function ResourcesPage({ searchParams }: { searchParams: { page?: string, search?: string } }) {
    const pageSize = 12;
    const search = searchParams.search || '';
    const page = parseInt(searchParams.page || '1', 10);

    const allSubjects = await prisma.subject.findMany();

    let filteredSubjects = allSubjects;
    if (search) {
        filteredSubjects = performSearch(search, allSubjects);
    }

    const totalCount = filteredSubjects.length;
    const totalPages = Math.ceil(totalCount / pageSize);

    let validatedPage = validatePage(page, totalPages);

    const startIndex = (validatedPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedSubjects = filteredSubjects.slice(startIndex, endIndex);

    if (validatedPage !== page) {
        redirect(`/resources?page=${validatedPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
    }

    return (
        <div className="container mx-auto p-4 flex flex-col min-h-screen">
            <h1 className="text-4xl font-bold text-center mb-4">Resource Repo</h1>
            <div className="flex justify-center">
                <div className="container flex items-center justify-center p-4 space-x-4 pt-2">
                    <SearchBar pageType="resources" initialQuery={search} />
                </div>
            </div>
            <div className="flex justify-center">
                <div className="w-3/4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
                    {paginatedSubjects.length > 0 ? (
                        paginatedSubjects.map((subject) => (
                            <ResourceCard key={subject.id} subject={subject} />
                        ))
                    ) : (
                        <p className="col-span-3 text-center">
                            {search
                                ? "No subjects found matching your search."
                                : "No subjects found."}
                        </p>
                    )}
                </div>
            </div>
            {totalPages > 1 && (
                <div className="mt-auto">
                    <Pagination
                        currentPage={validatedPage}
                        totalPages={totalPages}
                        basePath="/resources"
                        searchQuery={search}
                    />
                </div>
            )}
        </div>
    );
}
