import React from 'react';
import Fuse from 'fuse.js';
import {PastPaper, PrismaClient, Tag} from "@/src/generated/prisma";
import {redirect} from 'next/navigation';
import Pagination from '../../components/Pagination';
import PastPaperCard from '../../components/PastPaperCard';
import SearchBar from '../../components/SearchBar';
import UploadButtonPaper from '../../components/uploadButtonPaper';
import Dropdown from '../../components/FilterComponent';

const SCORE_THRESHOLD = 0.6;

type PastPaperWithTags = PastPaper & {
    tags: Tag[];
};

function validatePage(page: number, totalPages: number): number {
    if (isNaN(page) || page < 1) {
        return 1;
    }
    if (page > totalPages && totalPages > 0) {
        return totalPages;
    }
    return page;
}

function performSearch(query: string, dataSet: PastPaperWithTags[]) {
    const options = {
        includeScore: true,
        keys: [
            { name: 'title', weight: 1 },
            { name: 'tags.name', weight: 2 }
        ],
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2,
        findAllMatches: true,
        useExtendedSearch: true,
    };
    const fuse = new Fuse(dataSet, options);
    const searchResults = fuse.search({
        $or: [
            { title: query },
            { 'tags.name': query },
            { title: `'${query}` }
        ]
    });
    return searchResults
        .filter((fuseResult) => (fuseResult.score || 1) < SCORE_THRESHOLD)
        .map((fuseResult) => fuseResult.item);
}

async function pastPaperPage({ searchParams }: { searchParams: Promise<{ page?: string, search?: string, tags?: string | string[] }> }) {
    const prisma = new PrismaClient();
    const pageSize = 9;
    const params = await searchParams;
    const search = params.search || '';
    const page = parseInt(params.page || '1', 10);
    const tags: string[] = Array.isArray(params.tags)
        ? params.tags
        : (params.tags ? params.tags.split(',') : []);

    let filteredPastPapers = await prisma.pastPaper.findMany({
        where: {
            isClear: true,
            ...(tags.length > 0 && {
                tags: {
                    some: {
                        name: {
                            in: tags,
                        },
                    },
                },
            }),
        },
        include: {
            tags: true,
        },
        orderBy: {
            createdAt: 'desc',
        }
    });
    if (search) {
        filteredPastPapers = performSearch(search, filteredPastPapers);
    }

    const totalCount = filteredPastPapers.length;
    const totalPages = Math.ceil(totalCount / pageSize);

    const validatedPage = validatePage(page, totalPages);

    const startIndex = (validatedPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedPastPapers = filteredPastPapers.slice(startIndex, endIndex);

    if (validatedPage !== page) {
        const searchQuery = search ? `&search=${encodeURIComponent(search)}` : '';
        const tagsQuery = tags.length > 0 ? `&tags=${encodeURIComponent(tags.join(','))}` : '';
        redirect(`/past_papers?page=${validatedPage}${searchQuery}${tagsQuery}`);
    }

    return (
        <div className="p-8 transition-colors flex flex-col min-h-screen items-center text-black dark:text-[#D5D5D5]">
            <h1 className="text-center mb-4">Past Papers</h1>
            <div className="hidden w-5/6 lg:w-1/2 md:flex items-center justify-center p-4 space-y-4 sm:space-y-0 sm:space-x-4 pt-2">
                <Dropdown pageType='past_papers' />
                <SearchBar pageType="past_papers" initialQuery={search} />
                <UploadButtonPaper />
            </div>

            <div className='flex-col w-5/6 md:hidden space-y-4'>
                <SearchBar pageType="past_papers" initialQuery={search} />
                <div className='flex justify-between'>
                    <Dropdown pageType='past_papers' />
                    <UploadButtonPaper />
                </div>
            </div>


            {tags.length > 0 && (
                <div className="flex justify-center mb-4">
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag, index) => (
                            <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-center">
                <div className="w-fit grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-6  place-content-center">
                    {paginatedPastPapers.length > 0 ? (
                        paginatedPastPapers.map((eachPaper, index) => (
                            <div key={eachPaper.id} className="flex justify-center">
                                <PastPaperCard pastPaper={eachPaper} index={index} />
                            </div>
                        ))
                    ) : (
                        <p className="col-span-3 text-center">
                            {search || tags.length > 0
                                ? "No past papers found matching your search or selected tags."
                                : "No past papers found."}
                        </p>
                    )}
                </div>
            </div>
            {totalPages > 1 && (
                <div className="mt-4">
                    <Pagination
                        currentPage={validatedPage}
                        totalPages={totalPages}
                        basePath="/past_papers"
                        searchQuery={search}
                        tagsQuery={tags.join(',')}
                    />
                </div>
            )}
        </div>
    );
}

export default pastPaperPage;

