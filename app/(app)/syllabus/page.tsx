import React from "react";
import type { Metadata } from "next";
import { GradientText } from "@/app/components/landing_page/landing";
import SyllabusGrid from "@/app/components/syllabus/SyllabusGrid";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import { getAllSyllabi } from "@/lib/data/syllabus";
import { DEFAULT_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = {
    title: "Syllabus",
    description: "Browse VIT course syllabi — find your course by code or name.",
    keywords: DEFAULT_KEYWORDS,
    alternates: { canonical: "/syllabus" },
    robots: { index: true, follow: true },
};

export default async function SyllabusPage() {
    const syllabi = await getAllSyllabi();

    return (
        <DirectionalTransition>
            <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-3 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
                    <section className="flex flex-col gap-4">
                        <h1 className="whitespace-nowrap text-[1.35rem] font-black leading-none text-black dark:text-[#D5D5D5] min-[360px]:text-[1.45rem] min-[400px]:text-2xl sm:text-5xl lg:text-6xl">
                            Syllabus{" "}
                            <GradientText>Repository</GradientText>
                        </h1>
                        <div className="flex items-baseline gap-1.5 text-black/70 dark:text-[#D5D5D5]/70">
                            <span className="text-[1.7rem] font-black leading-none text-black dark:text-[#D5D5D5] sm:text-xl">
                                {syllabi.length.toLocaleString("en-US")}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-xs sm:tracking-wider">
                                courses
                            </span>
                        </div>
                    </section>

                    <SyllabusGrid syllabi={syllabi} />
                </div>
            </div>
        </DirectionalTransition>
    );
}
