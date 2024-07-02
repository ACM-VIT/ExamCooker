import React from "react";
import Pagination from "../components/Pagination";
import NotesCard from "../components/NotesCard";
import FilterComponent from "../components/FilterComponent";
import SearchBar from "../components/SearchBar";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import { redirect } from 'next/navigation';

function validatePage(page: string | undefined, totalPages: number): number {
    const parsedPage = parseInt(page || '', 10);
    if (isNaN(parsedPage) || parsedPage < 1 || parsedPage > totalPages || page !== parsedPage.toString()) {
        redirect('/notes?page=1');
    }
    return parsedPage;
}

async function notesPage({ searchParams }: { searchParams: { page?: string } }) {
    const prisma = new PrismaClient();
    // change the number of cards loaded with pagesize
    const pageSize = 9;
    const totalCount = await prisma.note.count();
    const totalPages = Math.ceil(totalCount / pageSize);

    const page = validatePage(searchParams.page, totalPages);
    const skip = (page - 1) * pageSize;

    const notes = await prisma.note.findMany({
        include: {
            author: true,
        },
        skip,
        take: pageSize,
    });

    return (
        <div>
            <h1 className="text-4xl font-bold text-center">Notes</h1>
            {/* back button */}
            <Link
                href={"/"}
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md shadow-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600"
            >
                Back
            </Link>

            {/* searchbar */}
            <div className="container mx-auto p-4">
                <h1 className="text-2xl font-bold mb-4">Search Example</h1>
                <SearchBar />
            </div>

            <div className="container mx-auto p-4 flex">
                {/* filter */}
                <div className="w-1/4 pr-4">
                    <h1 className="text-2xl font-bold mb-4">Dummy Filter</h1>
                    <FilterComponent />
                </div>

                {/* cards */}
                <div className="w-3/4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {notes.map((eachNote) => (
                        <NotesCard
                            key={eachNote.id}
                            note={eachNote}
                        />
                    ))}
                </div>
            </div>

            {/* pagination */}
            <Pagination currentPage={page} totalPages={totalPages} basePath="/notes" />
        </div>
    );
}

export default notesPage;