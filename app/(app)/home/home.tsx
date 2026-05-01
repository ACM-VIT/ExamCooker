import React, { Suspense } from "react";
import { auth } from "@/app/auth";
import { GradientText } from "@/app/components/landing_page/landing";
import ExamCookerLogo from "@/app/components/common/exam-cooker-logo";
import ExamsMarquee from "./exams-marquee";
import { getSearchableCourses } from "@/lib/data/course-catalog";
import { getUpcomingExams } from "@/lib/data/upcoming-exams";
import CourseSearch from "./course-search";
import HomeMarketingSections from "./home-marketing-sections";
import WelcomeBackSubtitle from "./welcome-back-subtitle";
import HeroFrame from "./hero-frame";
import { getDisplayUserName } from "./display-name";

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
    "text-sm sm:text-base lg:text-xl text-black/70 dark:text-[#D5D5D5]/70 md:text-white/85 dark:md:text-white/85 mb-6 sm:mb-8 lg:mb-10 max-w-2xl mx-auto";

function HomeSubtitle({ userName }: { userName: string | null }) {
    if (!userName) {
        return <p className={subtitleClass}>{HOME_SUBTITLE}</p>;
    }
    return (
        <WelcomeBackSubtitle className={subtitleClass}>
            Welcome back, {userName}
        </WelcomeBackSubtitle>
    );
}

async function PersonalizedHomeSubtitle() {
    const session = await auth();
    const userName = session?.user?.name
        ? getDisplayUserName(session.user.name)
        : null;

    return <HomeSubtitle userName={userName} />;
}

async function PersonalizedMarketingSections() {
    const session = await auth();
    return <HomeMarketingSections isAuthed={Boolean(session?.user)} />;
}

const Home = () => {
    return (
        <div className="overflow-x-clip bg-[#C2E6EC] dark:bg-[hsl(224,48%,9%)] text-black dark:text-[#D5D5D5] flex flex-col transition-colors">
            <HeroFrame>
                <section className="relative z-10 container mx-auto px-4 max-w-7xl min-h-[100svh] flex flex-col">
                    <div className="flex flex-1 flex-col justify-center text-center py-6 sm:py-8 md:py-10 lg:py-14">
                        <div className="mb-6 sm:mb-8 lg:mb-12 flex flex-col items-center">
                            <ExamCookerLogo />
                        </div>

                        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold leading-[1.02] drop-shadow-[0px_2px_rgba(59,244,199,1)]">
                            <GradientText>Cramming,</GradientText>
                        </h1>
                        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold leading-[1.02] mb-4 sm:mb-5 lg:mb-6">
                            Made Easy.
                        </h1>
                        <Suspense fallback={<HomeSubtitle userName={null} />}>
                            <PersonalizedHomeSubtitle />
                        </Suspense>

                        <HomeSearchSection />
                    </div>

                    <div className="pb-4 md:pb-6">
                        <Suspense fallback={null}>
                            <HomeMarqueeSection />
                        </Suspense>
                    </div>
                </section>
            </HeroFrame>

            <Suspense fallback={<HomeMarketingSections isAuthed />}>
                <PersonalizedMarketingSections />
            </Suspense>
        </div>
    );
};

export default Home;
