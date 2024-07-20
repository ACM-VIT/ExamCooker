import React from "react";
import { auth } from "@/app/auth";
import { PrismaClient, Note, PastPaper, ForumPost, Subject } from '@prisma/client';
import CommonResource from "@/app/components/CommonResource";
import UserName from "./display_username";
import { GradientText } from "@/app/components/landing_page/landing";

function getQuirkyLine() {
    const collection: string[] = [
        "You've got this! Even if 'this' means a borderline psychotic level of caffeine consumption.",
        "They laughed when I said I'd learn a semester's worth of material in one night. Now they're asking for my notes. #Who'sLaughingNow?",
        "Sleep is for the victors... of tomorrow's nap.",
        "Sleep is optional, caffeine is mandatory",
        "You might not feel like a genius now, but you will after this exam.",
        "Practice makes progress... and hopefully, perfection.",
        "Share your knowledge, save a life (or at least a grade)",
        "I'm not lazy, I'm just selectively productive.",
        "Coffee is my superpower.",
        "This coffee is keeping my sanity intact."
    ]

    return collection[Math.floor(Math.random() * collection.length)];
}

type ViewedItem =
    | { type: 'note', item: Note }
    | { type: 'pastPaper', item: PastPaper }
    | { type: 'forumPost', item: ForumPost }
    | { type: 'subject', item: Subject };

const prisma = new PrismaClient();
async function getRecentlyViewedItems(userId: string): Promise<ViewedItem[]> {
    const recentViews = await prisma.viewHistory.findMany({
        where: { userId: userId },
        orderBy: { viewedAt: 'desc' },
        take: 3,
        include: { note: true, pastPaper: true, forumPost: true, subject: true },
    });

    return recentViews
        .map(view => {
            if (view.note) return { type: 'note' as const, item: view.note };
            if (view.pastPaper) return { type: 'pastPaper' as const, item: view.pastPaper };
            if (view.forumPost) return { type: 'forumPost' as const, item: view.forumPost };
            if (view.subject) return { type: 'subject' as const, item: view.subject };
            return null;
        })
        .filter((item): item is ViewedItem => item !== null);
}
async function getFavoriteItems(userId: string): Promise<ViewedItem[]> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            bookmarkedNotes: {
                take: 2,
            },
            bookmarkedPastPapers: {
                take: 2
            },                          // Change these values as you need 
            bookmarkedForumPosts: {
                take: 2,
            },
            bookmarkedResources: {
                take: 2,
            },
        },
    });

    const notes = (user?.bookmarkedNotes || []).map(note => ({ type: 'note' as const, item: note }));
    const pastPapers = (user?.bookmarkedPastPapers || []).map(paper => ({ type: 'pastPaper' as const, item: paper }));
    const forumPosts = (user?.bookmarkedForumPosts || []).map(post => ({ type: 'forumPost' as const, item: post }));
    const subjects = (user?.bookmarkedResources || []).map(subject => ({ type: 'subject' as const, item: subject }));

    return [...notes, ...pastPapers, ...forumPosts, ...subjects];
}


const Home = async () => {
    const session = await auth();
    const userId = session?.user?.id;

    let recentlyViewedItems: ViewedItem[] = [];
    let favoriteItems: ViewedItem[] = [];

    if (userId) {
        recentlyViewedItems = await getRecentlyViewedItems(userId);
        favoriteItems = await getFavoriteItems(userId);
    }

    const getTitle = (item: ViewedItem['item']) => {
        if ('title' in item) {
            return item.title;
        } else if ('name' in item) {
            return item.name;
        }
        return 'Untitled';
    };
    return (
        <div className="bg-[#C2E6EC] dark:bg-[#0C1222] min-h-screen text-black dark:text-[#D5D5D5] flex flex-col transition-colors">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <header className="text-center mb-12">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4">Welcome <GradientText><UserName /></GradientText></h1>
                    <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300">{getQuirkyLine()}</p>
                </header>

                <main>
                    <section className="mb-16">
                        <div className="flex items-center justify-center text-xl sm:text-2xl font-bold mb-6 pt-4">
                            <div className="flex-grow border-t border-black dark:border-[#D5D5D5] "></div>
                            <span className="mx-4">Recently Viewed</span>
                            <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                            {recentlyViewedItems.map((item, index) => (
                                <CommonResource
                                    key={item.item.id}
                                    category={item.type}
                                    title={getTitle(item.item)} // maybe run migrations and change subject.name to title and then item.item.tile
                                    thing={item.item}
                                    index={index}
                                />
                            ))}
                        </div>
                    </section>

                    <section>
                        <div className="flex items-center justify-center text-xl sm:text-2xl font-bold mb-6 pt-4">
                            <div className="flex-grow border-t border-black dark:border-[#D5D5D5] "></div>
                            <span className="mx-4">Favourites</span>
                            <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                            {favoriteItems.slice(0, 9).map((item, index) => (
                                <CommonResource
                                    key={item.item.id}
                                    category={item.type}
                                    title={getTitle(item.item)}
                                    thing={item.item}
                                    index={index}
                                />
                            ))}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default Home;
