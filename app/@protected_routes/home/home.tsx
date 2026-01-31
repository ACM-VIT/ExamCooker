import React from "react";
import { auth } from "@/app/auth";
import { PrismaClient, Note, PastPaper, ForumPost, Subject } from '@/src/generated/prisma';
import CommonResource from "@/app/components/CommonResource";
import UserName from "./display_username";
import { GradientText } from "@/app/components/landing_page/landing";
import NothingViewedOrFavSvg from "@/public/assets/nothingviewedorfav.svg"
import Image from "next/image";
import Link from "next/link";

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

function NothingViewedOrFav({ sectionName }: { sectionName: string }) {
    sectionName = sectionName === "Favourites" ? "favourited" : "viewed";
    return (
        <div className="flex flex-col md:flex-row border rounded-lg w-fit md:w-2/3
            p-2 md:p-10 border-[#82BEE9] dark:border-[#D5D5D5]
            justify-evenly items-center md:items-start">
            <Image src={NothingViewedOrFavSvg} alt="Nothing Viewed Or Favourited" className="h-[100px] md:h-[150px] lg:h-[150px]" />
            <div className="flex flex-col gap-2 justify-center">
                <h3>You have not {sectionName} anything</h3>
                <div className="space-y-2">
                    <p>Go to:</p>
                    <div className="flex *:px-1 p-2 bg-[#82BEE9] text-sm md:text-base
                        dark:bg-[#232530] rounded-lg *:rounded-md justify-between
                        md:justify-center w-full md:w-fit items-center">
                        <Link href={'/past_papers'} className="bg-inherit hover:bg-white/10 ">Papers</Link>
                        <p>|</p>
                        <Link href={'/notes'} className="bg-inherit hover:bg-white/10">Notes</Link>
                        <p>|</p>
                        <Link href={'/forum'} className="bg-inherit hover:bg-white/10">Forum</Link>
                        <p>|</p>
                        <Link href={'/syllabus'} className="bg-inherit hover:bg-white/10">Syllabus</Link>
                        <p>|</p>
                        <Link href={'/resources'} className="bg-inherit hover:bg-white/10">Resources</Link>
                    </div>
                </div>
            </div>
        </div>
    );
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

    const emptyFav: boolean = favoriteItems.length === 0;
    const emptyRecentlyViewed: boolean = recentlyViewedItems.length === 0;

    const getTitle = (item: ViewedItem['item']) => {
        if ('title' in item) {
            return item.title;
        } else if ('name' in item) {
            return item.name;
        }
        return 'Untitled';
    };
    return (
        <div className="bg-[#C2E6EC] dark:bg-[hsl(224,48%,9%)] min-h-screen text-black dark:text-[#D5D5D5] flex flex-col transition-colors">
            {/* <Link 
  href="https://os.acmvit.in/" 
  target="_blank" 
  rel="noopener noreferrer"
>
  <div className="bg-[#5FC4E7] dark:bg-gradient-to-tr to-[#27BAEC] from-[#253EE0] dark:text-white text-center py-2 text-sm">
   Want to know what goes behind this cool website? Join our chapter to find out!
  </div>
</Link>  */}
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
                        {emptyRecentlyViewed &&
                            <div className="flex justify-center">
                                <NothingViewedOrFav sectionName="RecentlyViewed" />
                            </div>
                        }
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                            {recentlyViewedItems.map((item) => (
                                <CommonResource
                                    key={item.item.id}
                                    category={item.type}
                                    title={getTitle(item.item)} // maybe run migrations and change subject.name to title and then item.item.tile
                                    thing={item.item}
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
                        {emptyFav &&
                            <div className="flex justify-center">
                                <NothingViewedOrFav sectionName="Favourites" />
                            </div>
                        }
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                            {favoriteItems.length > 0 && favoriteItems.slice(0, 9).map((item) => (
                                <CommonResource
                                    key={item.item.id}
                                    category={item.type}
                                    title={getTitle(item.item)}
                                    thing={item.item}
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
