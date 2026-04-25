import React from "react";
import Image from "@/app/components/common/AppImage";
import PastPaper from "@/public/LandingPage/LandingPagePastPapers.svg";
import Notes from "@/public/LandingPage/LandingPageNotes.svg";
import Resources from "@/public/LandingPage/LandingPageResourceRepo.svg";
import Syllabus from "@/public/LandingPage/LandingPageSyllabus.svg";
import GradientHeart from "@/public/LandingPage/GradientHeart.svg";
import GradientACMLogo from "@/public/assets/ACM logo.svg";
import {
    GradientText,
    LandingPageCard,
    WordBetweenLine,
} from "@/app/components/landing_page/landing";
import { SignIn } from "@/app/components/sign-in";
import { auth } from "@/app/auth";

export default async function HomeMarketingSections() {
    const session = await auth();
    const isAuthed = Boolean(session?.user);

    return (
        <div className="space-y-24 bg-[#C2E6EC] pt-24 text-black transition-colors dark:bg-[#0C1222] dark:text-[#D5D5D5] md:space-y-40 lg:space-y-[18vh] lg:pt-40">
            <section className="min-h-screen bg-[#C2E6EC] dark:bg-[#0C1222] flex flex-col justify-center gap-10 px-4 py-16 md:gap-12 md:py-24 lg:min-h-0 lg:h-screen lg:py-12 lg:sticky lg:top-[-50px]">
                <WordBetweenLine>
                        For Crammers By Crammers

                </WordBetweenLine>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-5 mx-auto w-full max-w-5xl">
                    <LandingPageCard
                        title="Past Papers"
                        content="Conquer Your Exam Anxieties using our plethora of past papers"
                        imagePath={PastPaper}
                        altOfImage="PastPaper"
                        href="/past_papers"
                    />
                    <LandingPageCard
                        title="Notes"
                        content="Access and Contribute to a vibrant collection of notes, created by students like you!"
                        imagePath={Notes}
                        altOfImage="Notes"
                        href="/notes"
                    />
                    <LandingPageCard
                        title="Syllabus"
                        content="Know exactly what's in scope before you even start to cram"
                        imagePath={Syllabus}
                        altOfImage="Syllabus"
                        href="/syllabus"
                    />
                    <LandingPageCard
                        title="Resource Repo"
                        content="Expand your learning horizon through curated links to top-notch articles and videos"
                        imagePath={Resources}
                        altOfImage="ResourceRepo"
                        href="/resources"
                    />
                </div>
            </section>

            <section className="relative z-10 min-h-screen bg-[#C2E6EC] dark:bg-[#0C1222] flex flex-col justify-center gap-8 px-4 py-16 md:py-24 lg:min-h-0 lg:h-screen lg:py-12 lg:sticky lg:top-0">
                <WordBetweenLine>
                        Why Exam<GradientText>Cooker</GradientText>?
                </WordBetweenLine>
                <h4 className="px-4 md:px-16 text-center text-base md:text-lg lg:text-xl leading-relaxed max-w-4xl mx-auto">
                    Remember the days of desperately searching the web for past papers,
                    only to get lost in a maze of irrelevant links?
                    <br />
                    We do too! Thats why we built this website - a haven for students who
                    are tired of the exam prep struggle.
                    <br />
                    Here, everything you need to cram like a champion is under one roof.
                    <br />{" "}
                    <GradientText>Let&apos;s conquer those exams together!</GradientText>
                </h4>
            </section>

            {!isAuthed && (
                <section className="relative z-20 min-h-screen bg-[#8DCAE9] dark:bg-[#0C1222] overflow-hidden flex flex-col justify-center gap-8 px-4 py-16 md:py-24 lg:min-h-0 lg:h-screen lg:py-12 lg:sticky lg:top-0">
                    <div className="pointer-events-none absolute -top-32 -right-32 h-[22rem] w-[22rem] rounded-full bg-[#3BF4C7]/25 blur-[140px] dark:bg-[#3BF4C7]/20" />
                    <div className="pointer-events-none absolute -bottom-32 -left-32 h-[22rem] w-[22rem] rounded-full bg-[#253EE0]/20 blur-[140px] dark:bg-[#27BAEC]/25" />

                    <WordBetweenLine>
                        <div className="text-center">
                            Start <GradientText>Cooking</GradientText> Your
                            <br /> Academic <GradientText>Success</GradientText> Today
                        </div>
                    </WordBetweenLine>
                    <div className="relative grid gap-8 justify-center">
                        <SignIn displayText="Sign In" />
                    </div>
                </section>
            )}

            <section className="relative z-30 min-h-screen bg-[#8DCAE9] dark:bg-[#0C1222] flex flex-col justify-center gap-6 px-4 py-16 md:py-24 lg:min-h-0 lg:h-screen lg:py-12 lg:sticky lg:top-0">
                <WordBetweenLine>
                    <div className="flex items-center justify-center">
                            Made With
                        <Image
                            src={GradientHeart}
                            alt="Gradient Heart"
                            className="inline w-[45px] h-[45px] md:w-[120px] md:h-[120px] shrink-0"
                        />
                    </div>
                </WordBetweenLine>
                <div className="flex justify-center">
                    <Image
                        src={GradientACMLogo}
                        alt="ACM logo"
                        className="w-[220px] md:w-[500px] lg:w-[640px] h-auto max-w-full"
                    />
                </div>
            </section>
        </div>
    );
}
