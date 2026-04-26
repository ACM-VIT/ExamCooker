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
import HeroBackdropVideo from "./HeroBackdropVideo";

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
    "text-base md:text-xl text-black/70 dark:text-[#D5D5D5]/70 md:text-white/85 dark:md:text-white/85 mb-10 max-w-2xl mx-auto";

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
            <div className="relative md:text-white dark:md:text-white">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden md:block"
                >
                    <HeroBackdropVideo />
                    <div className="absolute inset-0 bg-[#C2E6EC]/10 dark:bg-[hsl(224,48%,9%)]/45" />
                    <div className="absolute inset-x-0 top-0 hidden h-32 bg-gradient-to-b to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
                    <div className="absolute inset-x-0 bottom-0 hidden h-32 bg-gradient-to-t to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
                    <div className="absolute inset-y-0 left-0 hidden w-32 bg-gradient-to-r to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
                    <div className="absolute inset-y-0 right-0 hidden w-32 bg-gradient-to-l to-transparent dark:block dark:from-[hsl(224,48%,9%)]" />
                </div>

                <section className="relative z-10 container mx-auto px-4 max-w-7xl min-h-screen flex flex-col">
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
            </div>

            <Suspense fallback={null}>
                <HomeMarketingSections />
            </Suspense>
        </div>
    );
};

export default Home;
