import React from "react";
import { auth } from "@/app/auth";
import CommonResource from "@/app/components/CommonResource";
import UserName from "./display_username";
import { GradientText } from "@/app/components/landing_page/landing";
import GuestHomeSections from "./GuestHomeSections";
import NothingViewedOrFav from "./NothingViewedOrFav";
import { getHomeFavorites, getHomeRecentViews, type HomeItem } from "@/lib/data/home";
import { getCoursesWithCounts } from "@/lib/data/courses";
import CourseSearch from "./CourseSearch";

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

const Home = async () => {
    const session = await auth();
    const userId = session?.user?.id;

    let recentlyViewedItems: HomeItem[] = [];
    let favoriteItems: HomeItem[] = [];
    const isAuthed = Boolean(userId);

    // Fetch courses for search - available to all users
    const courses = await getCoursesWithCounts();

    if (userId) {
        recentlyViewedItems = await getHomeRecentViews(userId);
        favoriteItems = await getHomeFavorites(userId);
    }

    const emptyFav: boolean = favoriteItems.length === 0;
    const emptyRecentlyViewed: boolean = recentlyViewedItems.length === 0;

    const getTitle = (item: HomeItem['item']) => {
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
                <header className="text-center mb-8">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4">Welcome <GradientText><UserName /></GradientText></h1>
                    <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-8">{getQuirkyLine()}</p>
                    
                    {/* Course Search - Centralized and Prominent */}
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
                            Find resources for your course
                        </h2>
                        <CourseSearch courses={courses} />
                    </div>
                </header>

                <main>
                    {isAuthed ? (
                        <div className="mt-10 lg:mt-25 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Recently Viewed */}
                            <section>
                                <div className="flex items-center text-xl sm:text-2xl font-bold mb-6">
                                    <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                                    <span className="mx-4 whitespace-nowrap">Recently Viewed</span>
                                    <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                                </div>
                                {emptyRecentlyViewed ? (
                                    <div className="flex justify-center">
                                        <NothingViewedOrFav sectionName="RecentlyViewed" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {recentlyViewedItems.map((item) => (
                                            <CommonResource
                                                key={item.item.id}
                                                category={item.type}
                                                title={getTitle(item.item)}
                                                thing={item.item}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* Favourites */}
                            <section>
                                <div className="flex items-center text-xl sm:text-2xl font-bold mb-6">
                                    <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                                    <span className="mx-4 whitespace-nowrap">Favourites</span>
                                    <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                                </div>
                                {emptyFav ? (
                                    <div className="flex justify-center">
                                        <NothingViewedOrFav sectionName="Favourites" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {favoriteItems.slice(0, 3).map((item) => (
                                            <CommonResource
                                                key={item.item.id}
                                                category={item.type}
                                                title={getTitle(item.item)}
                                                thing={item.item}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    ) : (
                        <GuestHomeSections />
                    )}
                </main>
            </div>
        </div>
    );
};

export default Home;
