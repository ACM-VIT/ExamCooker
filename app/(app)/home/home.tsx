import React, { Suspense } from "react";
import { auth } from "@/app/auth";
import UserName from "./display_username";
import { GradientText } from "@/app/components/landing_page/landing";
import ExamCookerLogo from "@/app/components/common/ExamCookerLogo";
import ExamsMarquee from "./ExamsMarquee";
import { getSearchableCourses } from "@/lib/data/courseCatalog";
import { getUpcomingExams } from "@/lib/data/upcomingExams";
import CourseSearch from "./CourseSearch";
import HomeMarketingSections from "./HomeMarketingSections";
import WelcomeBackSubtitle from "./WelcomeBackSubtitle";

const HOME_SUBTITLE = "Your one-stop solution to cram before exams.";

async function HomeSearchSection() {
    const courses = await getSearchableCourses();

    return (
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-0">
            <CourseSearch courses={courses} />
        </div>
    );
}

async function HomeMarqueeSection() {
    const upcomingExams = await getUpcomingExams(16);
    return <ExamsMarquee items={upcomingExams} />;
}

const subtitleClass =
    "text-base md:text-xl text-black/70 dark:text-[#D5D5D5]/70 mb-10 max-w-2xl mx-auto";

async function HomeSubtitle() {
    const session = await auth();
    if (!session?.user) {
        return <p className={subtitleClass}>{HOME_SUBTITLE}</p>;
    }
    return (
        <WelcomeBackSubtitle className={subtitleClass}>
            Welcome back, <UserName />
        </WelcomeBackSubtitle>
    );
}

const Home = () => {
    return (
        <div className="overflow-x-clip bg-[#C2E6EC] dark:bg-[hsl(224,48%,9%)] text-black dark:text-[#D5D5D5] flex flex-col transition-colors">
            <section className="container mx-auto px-4 max-w-7xl min-h-screen flex flex-col">
                <div className="flex flex-1 flex-col justify-center text-center py-10 md:py-14">
                    <div className="mb-10 md:mb-12 flex flex-col items-center">
                        <ExamCookerLogo />
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold leading-[1.02] drop-shadow-[0px_2px_rgba(59,244,199,1)]">
                        <GradientText>Cramming,</GradientText>
                    </h1>
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold leading-[1.02] mb-6">
                        Made Easy.
                    </h1>
                    <Suspense fallback={<p className={subtitleClass}>{HOME_SUBTITLE}</p>}>
                        <HomeSubtitle />
                    </Suspense>

                    <HomeSearchSection />
                </div>

                <div className="pb-4 md:pb-6">
                    <Suspense fallback={null}>
                        <HomeMarqueeSection />
                    </Suspense>
                </div>
            </section>

            <Suspense fallback={null}>
                <HomeMarketingSections />
            </Suspense>
        </div>
    );
};

export default Home;
