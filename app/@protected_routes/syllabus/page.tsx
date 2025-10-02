import React from 'react';
import { PrismaClient, syllabi } from '@/src/generated/prisma';
import SyllabusCard from '@/app/components/SyllabusCard';
import SearchBar from "../../components/SearchBar";
import Pagination from "../../components/Pagination";
import Fuse from 'fuse.js';

const prisma = new PrismaClient();
const SCORE_THRESHOLD = 0.6;

function validatePage(page: number, totalPages: number): number {
    if (isNaN(page) || page < 1) {
        return 1;
    }
    if (page > totalPages && totalPages > 0) {
        return totalPages;
    }
    return page;
}

function performSearch(query: string, dataSet: syllabi[]) {
    const options = {
        includeScore: true,
        keys: [
            { name: 'name', weight: 2 },
        ],
        threshold: 0.6,
        ignoreLocation: true,
        minMatchCharLength: 2,
        findAllMatches: true,
        useExtendedSearch: true
    };
    const fuse = new Fuse(dataSet, options);
    const searchResults = fuse.search(query);
    return searchResults
        .filter((fuseResult) => (fuseResult.score || 1) < SCORE_THRESHOLD)
        .map((fuseResult) => fuseResult.item);
}

export default async function SyllabusPage({ searchParams }: { searchParams: Promise<{ page?: string, search?: string }> }) {
    const syllabi = await prisma.syllabi.findMany();
    const pageSize = 16; // We'll keep this constant for server-side pagination
    const params = await searchParams;
    const search = params.search || '';
    const page = parseInt(params.page || '1', 10);
    
    let filteredSyllabi = syllabi;
    if (search) {
        filteredSyllabi = performSearch(search, syllabi);
    }

    const totalCount = filteredSyllabi.length;
    const totalPages = Math.ceil(totalCount / pageSize);

    const validatedPage = validatePage(page, totalPages);

    const startIndex = (validatedPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedSyllabi = filteredSyllabi.slice(startIndex, endIndex);

    return (
        <div className="min-h-screen text-black dark:text-gray-200 flex flex-col items-center justify-start p-8">
            <h1 className="text-center mb-4">Syllabus</h1>
            
            <div className="w-full max-w-3xl mb-6 sm:mb-8 pt-2">
                <SearchBar pageType="syllabus" initialQuery={search} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-[90vw]">
                {paginatedSyllabi.map((syllabus, index) => (
                    <div key={syllabus.id} className={`
                        ${index < 8 ? '' : 'hidden sm:block'}
                        ${index < 12 ? '' : 'hidden lg:block'}
                        ${index < 16 ? '' : 'hidden xl:block'}
                    `}>
                        <SyllabusCard syllabus={syllabus} />
                    </div>
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
        </div>
    );
}
