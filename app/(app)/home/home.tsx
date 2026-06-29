import React, { Suspense } from "react";
import { GradientText } from "@/app/components/landing/landing";
import Image from "@/app/components/common/app-image";
import ExamCookerLogo from "@/app/components/common/exam-cooker-logo";
import DirectionalTransition from "@/app/components/common/directional-transition";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import ExamsMarquee, { ExamsMarqueeFallback } from "./exams-marquee";
import { getSearchableCourses } from "@/lib/data/course-catalog";
import { getUpcomingExams } from "@/lib/data/upcoming-exams";
import CourseSearch from "./course-search";
import HomeMarketingSections from "./home-marketing-sections";
import HomeAuthSubtitle from "./home-auth-subtitle";
import HomeAuthSignInCta from "./home-auth-sign-in-cta";
import HeroFrame from "./hero-frame";

const subtitleClass =
    "ec-home-subtitle text-sm sm:text-base lg:text-xl text-black/70 dark:text-[#D5D5D5]/70 md:text-white/85 dark:md:text-white/85 mb-6 sm:mb-8 lg:mb-10 max-w-2xl mx-auto";

async function HomeSearchSection() {
    const courses = await getSearchableCourses();

    return (
        <div className="ec-home-search-shell mx-auto w-full max-w-4xl px-4 sm:px-0">
            <CourseSearch courses={courses} />
        </div>
    );
}

function HomeSearchFallback() {
    return (
        <div className="ec-home-search-shell mx-auto w-full max-w-4xl px-4 sm:px-0">
            <div className="mx-auto w-full min-w-0 text-left">
                <div className="relative">
                    <div className="ec-focus-ring relative flex h-12 w-full min-w-0 items-center overflow-hidden border border-black/25 bg-white pl-4 pr-2 dark:border-[#D5D5D5]/30 dark:bg-[#3D414E] sm:h-14 lg:h-16">
                        <Image
                            src={SearchIcon}
                            alt=""
                            width={24}
                            height={24}
                            className="size-5 shrink-0 dark:invert-[.835] sm:size-6"
                        />
                        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-3 text-sm text-black/50 dark:text-[#D5D5D5]/60 sm:px-4 sm:text-base lg:text-lg">
                            Search for a course...
                        </span>
                    </div>
                </div>
                <div className="mt-4 h-[10.75rem] sm:mt-6 sm:h-[8.75rem]" />
            </div>
        </div>
    );
}

async function HomeMarqueeSection() {
    const upcomingExams = await getUpcomingExams(16);
    return <ExamsMarquee items={upcomingExams} />;
}

const Home = () => {
    return (
        <DirectionalTransition>
            <div className="overflow-x-clip bg-[#C2E6EC] dark:bg-[hsl(224,48%,9%)] text-black dark:text-[#D5D5D5] flex flex-col transition-colors">
                <HeroFrame>
                    <section className="ec-home-hero-shell relative z-10 container mx-auto px-4 max-w-7xl min-h-[100svh] flex flex-col">
                        <div className="ec-home-hero-stack flex flex-1 flex-col justify-center text-center py-6 sm:py-8 md:py-10 lg:py-14">
                            <div className="ec-home-hero-brand mb-6 sm:mb-8 lg:mb-12 flex flex-col items-center">
                                <ExamCookerLogo />
                            </div>

                            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold leading-[1.02] drop-shadow-[0px_2px_rgba(59,244,199,1)]">
                                <GradientText>Cramming,</GradientText>
                            </h1>
                            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold leading-[1.02] mb-4 sm:mb-5 lg:mb-6">
                                Made Easy.
                            </h1>
                            <HomeAuthSubtitle className={subtitleClass} />

                            <Suspense fallback={<HomeSearchFallback />}>
                                <HomeSearchSection />
                            </Suspense>
                        </div>

                        <div className="ec-home-marquee-offset pb-4 md:pb-6 lg:pb-8">
                            <Suspense fallback={<ExamsMarqueeFallback />}>
                                <HomeMarqueeSection />
                            </Suspense>
                        </div>
                    </section>
                </HeroFrame>

                <HomeMarketingSections authSlot={<HomeAuthSignInCta />} />
            </div>
        </DirectionalTransition>
    );
};

export default Home;
