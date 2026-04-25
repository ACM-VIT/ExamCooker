import React from 'react';
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import PDFViewerClient from '@/app/components/PDFViewerClient';
import { notFound, permanentRedirect } from "next/navigation";
import ViewTracker from "@/app/components/ViewTracker";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import { getSyllabusDetail } from "@/lib/data/syllabusDetail";
import type { Metadata } from "next";
import {
    buildKeywords,
    DEFAULT_KEYWORDS,
    formatSyllabusDisplayName,
    getCourseSyllabusPath,
    parseSyllabusName,
} from "@/lib/seo";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const syllabus = await getSyllabusDetail(id);
    if (!syllabus) return {};
    const parsed = parseSyllabusName(syllabus.name);
    const title = parsed.displayName;
    const description = `View ${title} syllabus on ExamCooker.`;
    const canonical = parsed.courseCode
        ? getCourseSyllabusPath(parsed.courseCode)
        : `/syllabus/${syllabus.id}`;

    return {
        title,
        description,
        keywords: buildKeywords(DEFAULT_KEYWORDS, [
            title,
            parsed.courseCode ?? "",
            parsed.courseName ?? "",
        ]),
        alternates: { canonical },
        openGraph: {
            title,
            description,
            url: canonical,
        },
    };
}

async function SyllabusViewerPage({ params }: { params: Promise<{ id: string }> }) {
    let syllabus;
    const { id } = await params;

    try {
        syllabus = await getSyllabusDetail(id);

    } catch (error) {
        console.error('Error fetching syllabus:', error);
        return (
            <div>
                <div className="text-center p-8 dark:text-[#d5d5d5]">
                    Error loading syllabus. Please refresh, or try again later.
                </div>
            </div>
        );
    } finally {
        // no-op
    }

    if (!syllabus) {
        return notFound();
    }
    const parsed = parseSyllabusName(syllabus.name);
    const title = formatSyllabusDisplayName(syllabus.name);
    const backHref = parsed.courseCode ? getCourseSyllabusPath(parsed.courseCode) : "/syllabus";
    const backLabel = parsed.courseCode ?? "Syllabus";

    if (parsed.courseCode) {
        permanentRedirect(getCourseSyllabusPath(parsed.courseCode));
    }

    //const postTime: string = syllabus.createdAt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    return (
        <DirectionalTransition>
            <div className="min-h-dvh bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <ViewTracker
                    id={syllabus.id}
                    type="syllabus"
                    title={title}
                />

                <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 xl:px-10">
                    <Link
                        href={backHref}
                        transitionTypes={["nav-back"]}
                        className="group inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-black/55 hover:text-black dark:text-[#D5D5D5]/55 dark:hover:text-[#D5D5D5]"
                    >
                        <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.5} />
                        <span>Back to {backLabel}</span>
                    </Link>

                    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-pretty text-2xl font-bold leading-[1.15] tracking-tight sm:text-3xl lg:text-4xl">
                                {title}
                            </h1>
                            {parsed.courseCode || parsed.courseName ? (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {parsed.courseCode && (
                                        <span className="inline-flex items-center gap-1.5 border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]">
                                            <span className="text-[10px] uppercase tracking-wider text-black/45 dark:text-[#D5D5D5]/45">
                                                Course
                                            </span>
                                            <span>{parsed.courseCode}</span>
                                        </span>
                                    )}
                                    {parsed.courseName && (
                                        <span className="inline-flex items-center gap-1.5 border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]">
                                            <span className="text-[10px] uppercase tracking-wider text-black/45 dark:text-[#D5D5D5]/45">
                                                Syllabus
                                            </span>
                                            <span>{parsed.courseName}</span>
                                        </span>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </header>

                    <div className="overflow-hidden border border-black/15 bg-white shadow-[0_4px_28px_-14px_rgba(0,0,0,0.25)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:shadow-[0_4px_28px_-14px_rgba(0,0,0,0.6)]">
                        <div className="h-[70dvh] sm:h-[78dvh] lg:h-[84dvh] xl:h-[86dvh]">
                            <PDFViewerClient fileUrl={syllabus.fileUrl} />
                        </div>
                    </div>
                </div>
            </div>
        </DirectionalTransition>
    );
}

export default SyllabusViewerPage;
