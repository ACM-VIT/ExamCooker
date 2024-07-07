import React from "react";
import Fuse from 'fuse.js';
import Pagination from "@/app/components/Pagination";
import SearchBar from "@/app/components/SearchBar";
import Link from "next/link";
import { PrismaClient, ForumPost, Note, PastPaper, Subject } from "@prisma/client";
import Dropdown from "@/app/components/FilterComponent";
import FavFetch from '@/app/components/FavFetchFilter';

const prisma = new PrismaClient();

const SCORE_THRESHOLD = 0.6;

function performSearch<T>(query: string, dataSet: T[]): T[] {
    const options = {
        includeScore: true,
        keys: ['title', 'name', 'description', 'content'],
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2,
    };
    const fuse = new Fuse(dataSet, options);
    const searchResults = fuse.search(query);
    return searchResults
        .filter((fuseResult) => (fuseResult.score || 1) < SCORE_THRESHOLD)
        .map((fuseResult) => fuseResult.item);
}

async function favouritesPage({ searchParams }: { searchParams: { page?: string, search?: string } }) {
    const pageSize = 9;
    const search = searchParams.search || '';
    const page = parseInt(searchParams.page || '1', 10);

    const userBookmarks = await prisma.user.findUnique({
        where: {
            id: "cly0klo9800006hg6gwc73j5u",
        },
        select: {
            bookmarkedForumPosts: {
                include: {
                    author: true,
                    tags: true,
                    comments: true,
                },
            },
            bookmarkedNotes: true,
            bookmarkedPastPapers: true,
            bookmarkedResources: true,
        }
    });

    if (!userBookmarks) {
        throw new Error("User not found");
    }

    let filteredForumPosts = userBookmarks.bookmarkedForumPosts;
    let filteredNotes = userBookmarks.bookmarkedNotes;
    let filteredPastPapers = userBookmarks.bookmarkedPastPapers;
    let filteredResources = userBookmarks.bookmarkedResources;

    if (search) {
        filteredForumPosts = performSearch(search, filteredForumPosts);
        filteredNotes = performSearch(search, filteredNotes);
        filteredPastPapers = performSearch(search, filteredPastPapers);
        filteredResources = performSearch(search, filteredResources);
    }

    const totalCount = filteredForumPosts.length + filteredNotes.length +
        filteredPastPapers.length + filteredResources.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return (
        <div>
            <h1 className="text-4xl font-bold text-center p-4">Favourites</h1>
            <div className="container flex items-center justify-center p-4 space-x-4">
                <SearchBar pageType="favourites" initialQuery={search} />

            </div>
            <div className="p-5 flex items-center justify-center p-4 space-x-4">
                <FavFetch
                    pastpapers={filteredPastPapers}
                    notes={filteredNotes}
                    forumposts={filteredForumPosts}
                    resources={filteredResources}
                />
            </div>
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                basePath="/favourites"
                searchQuery={search}
            />
        </div>
    );
}

export default favouritesPage;
