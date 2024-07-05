import React from "react";
import Pagination from "@/app/components/Pagination";
import NotesCard from "@/app/components/NotesCard";
import SearchBar from "@/app/components/SearchBar";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import { redirect } from 'next/navigation';
import Dropdown from "@/app/components/FilterComponent";
import FavFetch from '@/app/components/FavFetchFilter';

const prisma = new PrismaClient();

function validatePage(page: string | undefined, totalPages: number): number {
    const parsedPage = parseInt(page || '', 10);
    if (isNaN(parsedPage) || parsedPage < 1 || parsedPage > totalPages || page !== parsedPage.toString()) {
        redirect('/favourites?page=1');
    }
    return parsedPage;
}


async function favouritesPage({searchParams, params}: {searchParams: { page?: string }; params: { userId: string; category: string };}) {
    const pageSize = 9;

    const totalCount = await prisma.note.count();
    const totalPages = Math.ceil(totalCount / pageSize);

    const page = validatePage(searchParams.page, totalPages);
    const skip = (page - 1) * pageSize;
    //const favourites = await fetchFavourites(userId, category, skip, pageSize);

    const userBookmarks = await prisma.user.findUnique({
          where: {
            id: "cly0klo9800006hg6gwc73j5u",
          },
          select: {
            id: true,
            name: true,
            email: true,
            bookmarkedForumPosts: {
                include : {
                    author : true,
                    tags : true,
                    comments : true,
                },
            },
            bookmarkedNotes: true, 
            bookmarkedPastPapers: true,
            bookmarkedResources: true,
          }
        });

    console.log(userBookmarks?.bookmarkedResources)
    return (
        <div>
            <h1 className="text-4xl font-bold text-center p-4">Favourites</h1>
            <Link
                href="/"
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md shadow-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600"
            >
                Back
            </Link>
            <div className="container flex items-center justify-center p-4 space-x-4">
                {/* WHY IS FAVOURITES NOT AN OPTION HERE */}
                {/* <SearchBar /> */}
                <Dropdown />
            </div>
            <div className="p-5">
                <FavFetch 
                pastpapers={userBookmarks!.bookmarkedPastPapers}
                notes={userBookmarks!.bookmarkedNotes}
                forumposts={userBookmarks!.bookmarkedForumPosts}
                resources={userBookmarks!.bookmarkedResources}/>
            </div>
            {/* <div className="w-3/4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {favourites.map((item) => (
                    <NotesCard key={item.id} note={item} />
                ))}
            </div> */}
            <Pagination currentPage={page} totalPages={totalPages} basePath="/favourites" />
        </div>
    );
}

export default favouritesPage;