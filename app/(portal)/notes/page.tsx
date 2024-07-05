// import React from "react";
// import Pagination from "../components/Pagination";
// import NotesCard from "../components/NotesCard";
// import SearchBar from "../components/SearchBar";
// import { PrismaClient, Prisma } from "@prisma/client";
// import { redirect } from 'next/navigation';
// import Dropdown from "../components/FilterComponent";
// import UploadButtonNotes from "../components/UploadButtonNotes";

// function validatePage(page: number, totalPages: number): number {
//     if (isNaN(page) || page < 1) {
//         return 1;
//     }
//     if (page > totalPages && totalPages > 0) {
//         return totalPages;
//     }
//     return page;
// }

// async function notesPage({ searchParams }: { searchParams: { page?: string, search?: string } }) {
//     const prisma = new PrismaClient();
//     const pageSize = 9;
//     const search = searchParams.search || '';
//     const page = parseInt(searchParams.page || '1', 10);

//     const whereClause: Prisma.NoteWhereInput = search
//         ? {
//             OR: [
//                 { title: { contains: search, mode: 'insensitive' } },
//                 { author: { name: { contains: search, mode: 'insensitive' } } },
//                 { tags: { some: { name: { contains: search, mode: 'insensitive' } } } },
//             ],
//         }
//         : {};

//     const totalCount = await prisma.note.count({ where: whereClause });
//     const totalPages = Math.ceil(totalCount / pageSize);

//     let validatedPage = validatePage(page, totalPages);
//     let notes: any[] = [];

//     if (totalCount === 0 && search) {
//         validatedPage = 1;
//         notes = await prisma.note.findMany({
//             include: {
//                 author: true,
//                 tags: true,
//             },
//             take: pageSize,
//             orderBy: { createdAt: 'desc' },
//         });
//     } else {
//         const skip = (validatedPage - 1) * pageSize;
//         notes = await prisma.note.findMany({
//             where: whereClause,
//             include: {
//                 author: true,
//                 tags: true,
//             },
//             skip,
//             take: pageSize,
//             orderBy: { createdAt: 'desc' },
//         });
//     }

//     if (validatedPage !== page) {
//         redirect(`/notes?page=${validatedPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
//     }

//     return (
//         <div className="flex flex-col min-h-screen">
//             <div className="container mx-auto p-4">
//                 <h1 className="text-4xl font-bold text-center mb-4">Notes</h1>

//                 <div className="flex justify-center">
//                     <div className="container flex items-center justify-center p-4 space-x-4 pt-2">
//                         <SearchBar pageType="notes" />
//                         <Dropdown />
//                         <UploadButtonNotes />
//                     </div>
//                 </div>

//                 <div className="flex justify-center">
//                     <div className="w-3/4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
//                         {notes.length > 0 ? (
//                             notes.map((eachNote) => (
//                                 <NotesCard
//                                     key={eachNote.id}
//                                     note={eachNote}
//                                 />
//                             ))
//                         ) : (
//                             <p className="col-span-3 text-center">
//                                 {search
//                                     ? "No notes found matching your search. Showing all notes."
//                                     : "No notes found."}
//                             </p>
//                         )}
//                     </div>
//                 </div>
//             </div>

//             {totalPages > 1 && (
//                 <div className="mt-auto">
//                     <Pagination
//                         currentPage={validatedPage}
//                         totalPages={totalPages}
//                         basePath="/notes"
//                         searchQuery={search}
//                     />
//                 </div>
//             )}
//         </div>
//     );
// }

// export default notesPage;

import React from "react";
import Pagination from "../components/Pagination";
import NotesCard from "../components/NotesCard";
import SearchBar from "../components/SearchBar";
import { PrismaClient, Prisma } from "@prisma/client";
import { redirect } from 'next/navigation';
import Dropdown from "../components/FilterComponent";
import UploadButtonNotes from "../components/UploadButtonNotes";

function validatePage(page: number, totalPages: number): number {
    if (isNaN(page) || page < 1) {
        return 1;
    }
    if (page > totalPages && totalPages > 0) {
        return totalPages;
    }
    return page;
}

async function notesPage({ searchParams }: { searchParams: { page?: string, search?: string } }) {
    const prisma = new PrismaClient();
    const pageSize = 9;
    const search = searchParams.search || '';
    const page = parseInt(searchParams.page || '1', 10);

    const whereClause: Prisma.NoteWhereInput = search
        ? {
            OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { author: { name: { contains: search, mode: 'insensitive' } } },
                { tags: { some: { name: { contains: search, mode: 'insensitive' } } } },
            ],
        }
        : {};

    const totalCount = await prisma.note.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / pageSize);

    let validatedPage = validatePage(page, totalPages);
    let notes: any[] = [];

    if (totalCount === 0 && search) {
        validatedPage = 1;
        notes = await prisma.note.findMany({
            include: {
                author: true,
                tags: true,
            },
            take: pageSize,
            orderBy: { createdAt: 'desc' },
        });
    } else {
        const skip = (validatedPage - 1) * pageSize;
        notes = await prisma.note.findMany({
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
        redirect(`/notes?page=${validatedPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
    }

    return (
        <div className="flex flex-col min-h-screen">
            <div className="container mx-auto p-4">
                <h1 className="text-4xl font-bold text-center mb-4">Notes</h1>

                <div className="flex justify-center">
                    <div className="container flex flex-col sm:flex-row items-center justify-center p-4 space-y-4 sm:space-y-0 sm:space-x-4 pt-2">
                        <SearchBar pageType="notes" />
                        <div className="flex space-x-4">
                            <Dropdown />
                            <UploadButtonNotes />
                        </div>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="w-3/4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
                        {notes.length > 0 ? (
                            notes.map((eachNote, index) => (
                                <NotesCard
                                    key={eachNote.id}
                                    note={eachNote}
                                    index={index}
                                />
                            ))
                        ) : (
                            <p className="col-span-3 text-center">
                                {search
                                    ? "No notes found matching your search. Showing all notes."
                                    : "No notes found."}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {totalPages > 1 && (
                <div className="mt-auto">
                    <Pagination
                        currentPage={validatedPage}
                        totalPages={totalPages}
                        basePath="/notes"
                        searchQuery={search}
                    />
                </div>
            )}
        </div>
    );
}

export default notesPage;
