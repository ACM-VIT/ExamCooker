import React from "react";
import Pagination from "../components/Pagination";
import NotesCard from "../components/NotesCard";
import SearchBar from "../components/SearchBar";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import { redirect } from 'next/navigation';
import Dropdown from "../components/FilterComponent";
import FavFetch from '../components/FavFetchFilter';

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
        <div className="">
            <h1 className="text-4xl font-bold text-center p-4">Favourites</h1>
                <SearchBar pageType="notes"/>
            <div className="p-5">
                <div>
                <FavFetch 
                    pastpapers={userBookmarks.bookmarkedPastPapers}
                    notes={userBookmarks.bookmarkedNotes}
                    forumposts={userBookmarks.bookmarkedForumPosts}
                    resources={userBookmarks.bookmarkedResources}/>
                </div>
            </div>
            <Pagination currentPage={page} totalPages={totalPages} basePath="/favourites" />
        </div>
    );
}

export default favouritesPage;