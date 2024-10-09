import React from 'react';
import { PrismaClient, syllabi } from '@prisma/client';
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

export default async function SyllabusPage({ searchParams }: { searchParams: { page?: string, search?: string } }) {
    const syllabi = await prisma.syllabi.findMany();
    const pageSize = 16;
    const search = searchParams.search || '';
    const page = parseInt(searchParams.page || '1', 10);
    
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
        <div className="transition-colors min-h-screen text-black dark:text-gray-200 flex flex-col items-center justify-center p10">
            <h1 className="text-center mb-4 pt-8">Syllabus</h1>
            <div className="hidden w-5/6 lg:w-1/2 md:flex items-center justify-center p-4 space-y-4 sm:space-y-0 sm:space-x-4 pt-2">
                <SearchBar pageType="syllabus" initialQuery={search} />
            </div>

            <div className='flex-col w-5/6 md:hidden space-y-4'>
                <SearchBar pageType="syllabus" initialQuery={search} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-7xl p-4">
                {paginatedSyllabi.map((syllabus) => (
                    <SyllabusCard 
                    key={syllabus.id} 
                    syllabus={syllabus} />
                ))}
            </div>

            {totalPages > 1 && (
                <div className="mt-auto">
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