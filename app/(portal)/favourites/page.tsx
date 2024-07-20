import React from "react";
import Fuse from 'fuse.js';
import Pagination from "@/app/components/Pagination";
import SearchBar from "@/app/components/SearchBar";
import { PrismaClient } from "@prisma/client";
import FavFetch from '@/app/components/FavFetchFilter';
import { auth } from "@/app/auth";

const prisma = new PrismaClient();

const SCORE_THRESHOLD = 0.6;
const PAGE_SIZE = 9;

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

async function favouritesPage({ searchParams }: { searchParams: { page?: string, search?: string, type?: string } }) {
    const search = searchParams.search || '';
    const page = parseInt(searchParams.page || '1', 10);
    const type = searchParams.type || 'Past Papers';
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        throw new Error("User not authenticated");
    }

    const userBookmarks = await prisma.user.findUnique({
        where: {
            email: session.user.email,
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
        },
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

    let itemsToDisplay: Array<{
        id: string;
        type: 'note' | 'pastpaper' | 'forumpost' | 'subject';
        title: string;
        [key: string]: any;
    }> = [];
    let totalCount: number;

    switch (type) {
        case 'Past Papers':
            totalCount = filteredPastPapers.length;
            itemsToDisplay = filteredPastPapers.map(paper => ({ ...paper, type: 'pastpaper' as const, title: paper.title }));
            break;
        case 'Notes':
            totalCount = filteredNotes.length;
            itemsToDisplay = filteredNotes.map(note => ({ ...note, type: 'note' as const, title: note.title }));
            break;
        case 'Forum':
            totalCount = filteredForumPosts.length;
            itemsToDisplay = filteredForumPosts.map(post => ({
                ...post,
                type: 'forumpost' as const,
                title: post.title,
                description: post.description,
                author: post.author,
                tags: post.tags,
                comments: post.comments,
                upvoteCount: post.upvoteCount,
                downvoteCount: post.downvoteCount,
                createdAt: post.createdAt,
                updatedAt: post.updatedAt,
            }));
            break;
        case 'Resources':
            totalCount = filteredResources.length;
            itemsToDisplay = filteredResources.map(resource => ({ ...resource, type: 'subject' as const, title: resource.name }));
            break;
        default:
            totalCount = filteredForumPosts.length + filteredNotes.length +
                filteredPastPapers.length + filteredResources.length;
            itemsToDisplay = [
                ...filteredForumPosts.map(post => ({
                    ...post,
                    type: 'forumpost' as const,
                    title: post.title,
                    description: post.description,
                    author: post.author,
                    tags: post.tags,
                    comments: post.comments,
                    upvoteCount: post.upvoteCount,
                    downvoteCount: post.downvoteCount,
                    createdAt: post.createdAt,
                    updatedAt: post.updatedAt,
                })),
                ...filteredNotes.map(note => ({ ...note, type: 'note' as const, title: note.title })),
                ...filteredPastPapers.map(paper => ({ ...paper, type: 'pastpaper' as const, title: paper.title })),
                ...filteredResources.map(resource => ({ ...resource, type: 'subject' as const, title: resource.name }))
            ];
    }

    itemsToDisplay = itemsToDisplay.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    return (
        <div className="transition-colors container mx-auto text-black dark:text-[#D5D5D5] overflow-hidden">
            <h1 className="text-center p-4 pb-6">Favourites</h1>
            <div className="container w-5/6 lg:w-1/2 flex items-center mx-auto pb-10 pt-4">
                <SearchBar pageType="favourites" initialQuery={search} />
            </div>
            <div className="flex items-center justify-center">
                <FavFetch
                    items={itemsToDisplay}
                    activeTab={type}
                />
            </div>
            {totalPages > 1 && (
                <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    basePath="/favourites"
                    searchQuery={search}
                    typeQuery={type}
                />
            )}
        </div>
    );
}


export default favouritesPage;
