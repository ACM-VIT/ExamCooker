import React from "react";
import Pagination from "../components/Pagination";
import NotesCard from "../components/NotesCard";
import FilterComponent from "../components/FilterComponent";
import SearchBar from "../components/SearchBar";
//import SearchBar from "../components/filter/SearchBarFilter";
//import FilterComp from "../components/filter/filteroptions";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import { redirect } from 'next/navigation';
import Dropdown from "../components/FilterComponent";
import UploadButton from "../components/UploadButton";

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
            <h1 className="text-4xl font-bold text-center pt-4">Notes</h1>
            {/* back button 
                        <Link
                href={"/"}
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md shadow-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600"
            >
                Back
            </Link> */}

            {/* searchbar */}
            <div className="flex justify-center">
            <div className="container flex items-center justify-center p-4 space-x-4">
                <SearchBar />
                <Dropdown />
                <UploadButton/>
            </div>
            </div>

            {/* cards */}
            <div className="flex justify-center">
            <div className="w-3/4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {notes.map((eachNote) => (
                    <NotesCard
                        key={eachNote.id}
                        note={eachNote}
                    />
                ))}
            </div>
            </div>

            <Pagination currentPage={page} totalPages={totalPages} basePath="/notes" />
        </div >
    );
}

export default notesPage;