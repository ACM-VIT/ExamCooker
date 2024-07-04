import React from "react";
import Pagination from "../components/Pagination";
import PastPaperCard from "../components/PastPaperCard";
import FilterComponent from "../components/FilterComponent";
import SearchBar from "../components/SearchBar";
import { PrismaClient, Prisma } from "@prisma/client";
import UploadButtonPaper from "../components/uploadButtonPaper";
import { redirect } from "next/navigation";

function validatePage(page: number, totalPages: number): number {
    if (isNaN(page) || page < 1) {
        return 1;
    }
    if (page > totalPages && totalPages > 0) {
        return totalPages;
    }
    return page;
}

async function pastPaperPage({ searchParams }: { searchParams: { page?: string, search?: string } }) {
    const prisma = new PrismaClient();
    const pageSize = 9;
    const search = searchParams.search || '';
    const page = parseInt(searchParams.page || '1', 10);

    const whereClause: Prisma.PastPaperWhereInput = search
        ? {
            OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { author: { name: { contains: search, mode: 'insensitive' } } },
                { tags: { some: { name: { contains: search, mode: 'insensitive' } } } },
            ],
        }
        : {};

    const totalCount = await prisma.pastPaper.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / pageSize);

    let validatedPage = validatePage(page, totalPages);
    let pastPapers: any[] = [];

    if (totalCount === 0 && search) {
        //TODO :  If no results found for search, show something 'not matching' and display first page ? 
        validatedPage = 1;
        pastPapers = await prisma.pastPaper.findMany({
            include: {
                author: true,
                tags: true,
            },
            take: pageSize,
            orderBy: { createdAt: 'desc' },
        });
    } else {
        const skip = (validatedPage - 1) * pageSize;
        pastPapers = await prisma.pastPaper.findMany({
            where: whereClause,
            include: {
                author: true,
                tags: true,
            },
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
        });
    }

    if (validatedPage !== page) {
        redirect(`/past_papers?page=${validatedPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
    }

    return (
        <div className="flex flex-col min-h-screen">
            <div className="container mx-auto p-4">
                <h1 className="text-4xl font-bold text-center mb-4">Past Papers</h1>

                <div className="flex justify-center">
                    <div className="container flex items-center justify-center p-4 space-x-4 pt-2">
                        <SearchBar pageType="past_papers" />
                        <FilterComponent />
                        <UploadButtonPaper />
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="w-3/4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
                        {pastPapers.length > 0 ? (
                            pastPapers.map((eachPaper) => (
                                <PastPaperCard
                                    key={eachPaper.id}
                                    pastPaper={eachPaper}
                                />
                            ))
                        ) : (
                            <p className="col-span-3 text-center">No past papers found. Showing all papers.</p>
                        )}
                    </div>
                </div>
            </div>

            {totalPages > 1 && (
                <div className="mt-auto">
                    <Pagination
                        currentPage={validatedPage}
                        totalPages={totalPages}
                        basePath="/past_papers"
                        searchQuery={search}
                    />
                </div>
            )}
        </div>
    );
}

export default pastPaperPage;
