import React, { Suspense } from "react";
import { auth } from "@/app/auth";
import CommonResource from "@/app/components/CommonResource";
import UserName from "./display_username";
import { GradientText } from "@/app/components/landing_page/landing";
import GuestHomeSections from "./GuestHomeSections";
import NothingViewedOrFav from "./NothingViewedOrFav";
import UpcomingExamsStrip from "@/app/components/past_papers/UpcomingExamsStrip";
import { getHomeFavorites, getHomeRecentViews, type HomeItem } from "@/lib/data/home";
import { getCoursesWithCounts } from "@/lib/data/courses";
import { getUpcomingExams } from "@/lib/data/upcomingExams";
import CourseSearch from "./CourseSearch";

const HOME_SUBTITLE =
    "Find the papers, notes, syllabus, and resources you need without the scavenger hunt.";

function getTitle(item: HomeItem["item"]) {
    if ("title" in item) {
        return item.title;
    }

    if ("name" in item) {
        return item.name;
    }

    return "Untitled";
}

function renderSection(
    sectionName: "Recently Viewed" | "Favourites",
    items: HomeItem[],
) {
    return (
        <section>
            <div className="flex items-center text-xl sm:text-2xl font-bold mb-6">
                <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                <span className="mx-4 whitespace-nowrap">{sectionName}</span>
                <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
            </div>
            <div className="flex flex-col gap-4">
                {items.length > 0 ? (
                    items.map((item) => (
                        <CommonResource
                            key={item.item.id}
                            category={item.type}
                            title={getTitle(item.item)}
                            thing={item.item}
                        />
                    ))
                ) : (
                    <NothingViewedOrFav sectionName={sectionName} />
                )}
            </div>
        </section>
    );
}

async function HomeSearchSection() {
    const courses = await getCoursesWithCounts();

    return (
        <div className="max-w-3xl mx-auto">
            <h2 className="text-base sm:text-lg font-bold mb-3 text-black dark:text-[#D5D5D5]">
                Find resources for your course
            </h2>
            <CourseSearch courses={courses} />
        </div>
    );
}

async function HomeUpcomingExamsSection() {
    const upcomingExams = await getUpcomingExams(12);

    return <UpcomingExamsStrip items={upcomingExams} variant="home" />;
}

async function HomePersonalizedSections() {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
        return <GuestHomeSections />;
    }

    const [recentlyViewedItems, favoriteItems] = await Promise.all([
        getHomeRecentViews(userId),
        getHomeFavorites(userId),
    ]);
    const showHomeSections =
        recentlyViewedItems.length > 0 || favoriteItems.length > 0;

    if (!showHomeSections) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {renderSection("Recently Viewed", recentlyViewedItems)}
            {renderSection("Favourites", favoriteItems.slice(0, 3))}
        </div>
    );
}

const Home = () => {
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
                    <p className="text-base md:text-xl text-black/70 dark:text-[#D5D5D5]/70 mb-8">{HOME_SUBTITLE}</p>

                    <HomeSearchSection />
                </header>

                <main className="flex flex-col gap-10">
                    <div className="mt-6">
                        <HomeUpcomingExamsSection />
                    </div>

                    <Suspense fallback={null}>
                        <HomePersonalizedSections />
                    </Suspense>
                </main>
            </div>
        </div>
    );
};

export default Home;
