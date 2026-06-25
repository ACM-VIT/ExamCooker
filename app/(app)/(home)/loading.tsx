import { GradientText } from "@/app/components/landing/landing";
import Image from "@/app/components/common/app-image";
import ExamCookerLogo from "@/app/components/common/exam-cooker-logo";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import { ExamsMarqueeFallback } from "@/app/(app)/home/exams-marquee";

function HomeSearchLoadingShell() {
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

export default function Loading() {
    return (
        <div className="overflow-x-clip bg-[#C2E6EC] text-black transition-colors dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
            <section className="ec-home-hero-shell relative z-10 container mx-auto flex min-h-[100svh] max-w-7xl flex-col px-4">
                <div className="ec-home-hero-stack flex flex-1 flex-col justify-center py-6 text-center sm:py-8 md:py-10 lg:py-14">
                    <div className="ec-home-hero-brand mb-6 flex flex-col items-center sm:mb-8 lg:mb-12">
                        <ExamCookerLogo />
                    </div>
                    <h1 className="text-4xl font-extrabold leading-[1.02] drop-shadow-[0px_2px_rgba(59,244,199,1)] sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl">
                        <GradientText>Cramming,</GradientText>
                    </h1>
                    <h1 className="mb-4 text-4xl font-extrabold leading-[1.02] sm:mb-5 sm:text-5xl md:text-6xl lg:mb-6 lg:text-7xl xl:text-8xl">
                        Made Easy.
                    </h1>
                    <p className="ec-home-subtitle mx-auto mb-6 max-w-2xl text-sm text-black/70 dark:text-[#D5D5D5]/70 sm:mb-8 sm:text-base md:text-white/85 dark:md:text-white/85 lg:mb-10 lg:text-xl">
                        Your one-stop solution to cram before exams.
                    </p>
                    <HomeSearchLoadingShell />
                </div>
                <div className="ec-home-marquee-offset pb-4 md:pb-6 lg:pb-8">
                    <ExamsMarqueeFallback />
                </div>
            </section>
        </div>
    );
}
