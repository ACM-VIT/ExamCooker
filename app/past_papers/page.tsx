import React from "react";
import Pagination from "../components/Pagination";
import PastPaperCard from "../components/PastPaperCard";
import FilterComponent from "../components/FilterComponent";
import SearchBar from "../components/SearchBar";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import { redirect } from 'next/navigation';
import UploadButtonPaper from "../components/uploadButtonPaper";


function validatePage(page: string | undefined, totalPages: number): number {
    const parsedPage = parseInt(page || '', 10);
    if (isNaN(parsedPage) || parsedPage < 1 || parsedPage > totalPages || page !== parsedPage.toString()) {
        redirect('/past_papers?page=1');
    }
    return parsedPage;
}


async function pastPaperPage({ searchParams }: { searchParams: { page?: string } }) {
    const prisma = new PrismaClient();
    // change the number of cards loaded with pagesize
    const pageSize = 9;
    const totalCount = await prisma.pastPaper.count();
    const totalPages = Math.ceil(totalCount / pageSize);

    const page = validatePage(searchParams.page, totalPages);
    const skip = (page - 1) * pageSize;

    const pastPapers = await prisma.pastPaper.findMany({
        include: {
            author: true,
        },
        skip,
        take: pageSize,
    });

    return (
        <div className="flex flex-col min-h-screen">
            <div className="container mx-auto p-4">
                <h1 className="text-4xl font-bold text-center mb-4">Past Papers</h1>
                {/* back button
                                <Link
                    href="/"
                    className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md shadow-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600 mb-4"
                >
                    Back
                </Link> */}


                {/* searchbar */}
                <div className="flex justify-center">
                    <div className="container flex items-center justify-center p-4 space-x-4 pt-2">
                        <SearchBar />
                        <FilterComponent />
                        <UploadButtonPaper />
                    </div>
                </div>

                {/* cards */}
                <div className="flex justify-center">
                    <div className="w-3/4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
                        {pastPapers.map((eachPaper) => (
                            <PastPaperCard
                                key={eachPaper.id}
                                pastPaper={eachPaper}
                            />
                        ))}
                    </div>
                </div>
            </div>


            {/* pagination */}
            <div className="mt-auto">
                <Pagination currentPage={page} totalPages={totalPages} basePath="/past_papers" />
            </div>
        </div>
    );
}

export default pastPaperPage;
