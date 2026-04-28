import React from 'react';
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PDFViewerClient from '@/app/components/PDFViewerClient';
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import RecentPaperStrip from "@/app/components/past_papers/RecentPaperStrip";
import ShareLink from '@/app/components/ShareLink';
import ViewTracker from "@/app/components/ViewTracker";
import {
    getAdjacentPapersInCourse,
    getPastPaperDetail,
    getSiblingPastPaper,
    getRelatedPapersForCourse,
} from "@/lib/data/pastPaperDetail";
import ItemActions from "@/app/components/ItemActions";
// import PastPaperTagEditor from "@/app/components/PastPaperTagEditor";
import { absoluteUrl, buildKeywords, DEFAULT_KEYWORDS, getPastPaperDetailPath } from "@/lib/seo";
import { normalizeCourseCode } from "@/lib/courseTags";
import { examTypeLabel } from "@/lib/examSlug";
import { buildPastPaperPdfFileName } from "@/lib/downloads/resourceNames";
import type { ExamType } from "@/src/db";

//todo refactor to utility function and move to lib
const ACRONYM_SKIP_WORDS = new Set([
    "and",
    "or",
    "of",
    "the",
    "for",
    "to",
    "in",
    "on",
    "with",
    "lab",
    "laboratory",
]);

function buildCourseAcronym(courseTitle: string): string {
    return courseTitle
        .replace(/\[[^\]]+\]/g, " ")
        .split(/[\s/-]+/)
        .map((word) => word.replace(/[^A-Za-z]/g, ""))
        .filter(Boolean)
        .filter((word) => /^[A-Z]/.test(word))
        .filter((word) => !ACRONYM_SKIP_WORDS.has(word.toLowerCase()))
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("");
}

function getHeadingTitle(courseTitle: string): string {
    const acronym = buildCourseAcronym(courseTitle);
    const isLikelyToWrap = courseTitle.length > 30 || courseTitle.split(/\s+/).length > 4;

    return isLikelyToWrap && acronym.length >= 2 ? acronym : courseTitle;
}

function PaperNavButton({
    direction,
    href,
    year,
    examType,
    slot,
}: {
    direction: "prev" | "next";
    href: string;
    year: number | null;
    examType: ExamType | null;
    slot: string | null;
}) {
    const isPrev = direction === "prev";
    const examLabel = examType ? examTypeLabel(examType) : null;
    const tooltip = [
        isPrev ? "Previous paper" : "Next paper",
        year !== null ? `· ${year}` : "",
        examLabel ? `· ${examLabel}` : "",
        slot ? `· ${slot}` : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            className={`group absolute top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-stretch sm:flex ${
                isPrev
                    ? "right-full mr-4 lg:mr-6 xl:mr-8"
                    : "left-full ml-4 lg:ml-6 xl:ml-8"
            }`}
        >
            <div className="absolute inset-0 dark:bg-[#3BF4C7]" />
            <div className="absolute inset-0 blur-[60px] bg-[#3BF4C7] opacity-0 transition duration-200 group-hover:opacity-20 dark:hidden" />
            <div className="dark:absolute dark:inset-0 dark:blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
            <Link
                href={href}
                transitionTypes={[isPrev ? "nav-back" : "nav-forward"]}
                aria-label={tooltip}
                title={tooltip}
                className="relative inline-flex h-full w-full items-center justify-center border-2 border-black bg-[#3BF4C7] text-black transition duration-150 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:-translate-x-1 dark:group-hover:-translate-y-1 dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7]"
            >
                {isPrev ? (
                    <ChevronLeft
                        className="h-5 w-5 transition-transform group-hover:-translate-x-0.5"
                        strokeWidth={2.5}
                    />
                ) : (
                    <ChevronRight
                        className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
                        strokeWidth={2.5}
                    />
                )}
            </Link>
        </div>
    );
}

async function PdfViewerPage({ params }: { params: Promise<{ code: string; id: string }> }) {
    const { code, id } = await params;

    const paper = await getPastPaperDetail(id);
    if (!paper) return notFound();

    const canonicalCode = paper.course?.code ?? "unassigned";

    if (normalizeCourseCode(code) !== canonicalCode && code !== canonicalCode) {
        permanentRedirect(getPastPaperDetailPath(paper.id, canonicalCode));
    }

    const displayTitle = paper.course?.title ?? paper.title.replace(/\.pdf$/i, "");
    const headingTitle = paper.course?.title ? getHeadingTitle(paper.course.title) : displayTitle;
    const displaySlot = paper.slot ?? undefined;
    const displayYear = paper.year?.toString() ?? undefined;
    const displayExam = paper.examType ? examTypeLabel(paper.examType) : undefined;
    const downloadFileName = buildPastPaperPdfFileName({
        courseCode: paper.course?.code ?? canonicalCode,
        courseTitle: paper.course?.title,
        title: paper.title,
        examLabel: displayExam,
        slot: paper.slot,
        year: paper.year,
        hasAnswerKey: paper.hasAnswerKey,
    });

    const [relatedPapers, adjacent, siblingPaper] = paper.courseId
        ? await Promise.all([
              getRelatedPapersForCourse({
                  paperId: paper.id,
                  courseId: paper.courseId,
                  examType: paper.examType,
                  limit: 8,
              }),
              getAdjacentPapersInCourse({
                  paperId: paper.id,
                  courseId: paper.courseId,
              }),
              getSiblingPastPaper({
                  paperId: paper.id,
                  questionPaperId: paper.questionPaperId,
                  courseId: paper.courseId,
                  examType: paper.examType,
                  slot: paper.slot,
                  year: paper.year,
                  semester: paper.semester,
                  campus: paper.campus,
                  hasAnswerKey: paper.hasAnswerKey,
              }),
          ])
        : [[], { prev: null, next: null }, null];

    const relatedItems = relatedPapers.map((item) => ({
        id: item.id,
        title: item.title,
        thumbNailUrl: item.thumbNailUrl,
        courseCode: item.course?.code ?? null,
        courseTitle: item.course?.title ?? null,
        examType: item.examType,
        year: item.year,
    }));

    const metaPills: Array<{ label: string; value: string }> = [];
    if (displayExam) metaPills.push({ label: "Exam", value: displayExam });
    if (displaySlot) metaPills.push({ label: "Slot", value: displaySlot });
    if (displayYear) metaPills.push({ label: "Year", value: displayYear });

    const courseHref = `/past_papers/${canonicalCode}`;
    const backLabel = paper.course?.code ?? "Past papers";

    const buildSideNavHref = (
        item: NonNullable<typeof adjacent.prev> | NonNullable<typeof adjacent.next>,
    ) => `/past_papers/${item.course?.code ?? canonicalCode}/paper/${item.id}`;

    return (
        <DirectionalTransition>
            <div className="min-h-dvh bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <ViewTracker id={paper.id} type="pastpaper" title={displayTitle} />

                <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 xl:px-10">
                    <Link
                        href={courseHref}
                        transitionTypes={["nav-back"]}
                        className="group inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-black/55 hover:text-black dark:text-[#D5D5D5]/55 dark:hover:text-[#D5D5D5]"
                    >
                        <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.5} />
                        <span>Back to {backLabel}</span>
                    </Link>

                    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-pretty text-2xl font-bold leading-[1.15] tracking-tight sm:text-3xl lg:text-4xl">
                                {headingTitle}
                            </h1>
                            {metaPills.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {metaPills.map(({ label, value }) => (
                                        <span
                                            key={label}
                                            className="inline-flex items-center gap-1.5 border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]"
                                        >
                                            <span className="text-[10px] uppercase tracking-wider text-black/45 dark:text-[#D5D5D5]/45">
                                                {label}
                                            </span>
                                            <span>{value}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                            {/* <p className="mt-3 text-xs text-black/55 dark:text-[#D5D5D5]/55">
                                Posted by <span className="font-semibold text-black/75 dark:text-[#D5D5D5]/75">{authorName}</span>
                                <span className="mx-1.5" aria-hidden>·</span>
                                {postedAtLine}
                            </p> */}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:pt-1">
                            {siblingPaper ? (
                                <Link
                                    href={getPastPaperDetailPath(siblingPaper.id, siblingPaper.course?.code ?? canonicalCode)}
                                    transitionTypes={["nav-forward"]}
                                    className="inline-flex items-center justify-center border border-black/15 bg-white px-3 py-2 text-sm font-semibold text-black transition hover:border-black/30 hover:bg-black/5 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#D5D5D5]/30 dark:hover:bg-white/5"
                                >
                                    {siblingPaper.hasAnswerKey ? "Answer key" : "Question paper"}
                                </Link>
                            ) : null}
                            <ItemActions
                                itemId={paper.id}
                                title={paper.title}
                                authorId={paper.author?.id}
                                activeTab="pastPaper"
                            />
                            <ShareLink fileType="this Past Paper" />
                        </div>
                    </header>

                    <div className="relative">
                        {adjacent.prev && (
                            <PaperNavButton
                                direction="prev"
                                href={buildSideNavHref(adjacent.prev)}
                                year={adjacent.prev.year}
                                examType={adjacent.prev.examType}
                                slot={adjacent.prev.slot}
                            />
                        )}
                        {adjacent.next && (
                            <PaperNavButton
                                direction="next"
                                href={buildSideNavHref(adjacent.next)}
                                year={adjacent.next.year}
                                examType={adjacent.next.examType}
                                slot={adjacent.next.slot}
                            />
                        )}
                        <div className="overflow-hidden border border-black/15 bg-white shadow-[0_4px_28px_-14px_rgba(0,0,0,0.25)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:shadow-[0_4px_28px_-14px_rgba(0,0,0,0.6)]">
                            <div className="h-[70dvh] sm:h-[78dvh] lg:h-[84dvh] xl:h-[86dvh]">
                                <PDFViewerClient
                                    fileUrl={paper.fileUrl}
                                    fileName={downloadFileName}
                                />
                            </div>
                        </div>
                    </div>

                    {relatedItems.length > 0 && (
                        <RecentPaperStrip items={relatedItems} title="Related papers" />
                    )}
                </div>
            </div>
        </DirectionalTransition>
    );
}

export default PdfViewerPage;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ code: string; id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const paper = await getPastPaperDetail(id);
    if (!paper) return {};

    const canonicalCode = paper.course?.code ?? "unassigned";
    const displayTitle = paper.course?.title ?? paper.title.replace(/\.pdf$/i, "");
    const canonical = getPastPaperDetailPath(paper.id, canonicalCode);
    const description = `View ${displayTitle} past paper on ExamCooker.`;
    const keywords = buildKeywords(
        DEFAULT_KEYWORDS,
        paper.tags.map((tag) => tag.name),
    );

    return {
        title: displayTitle,
        description,
        openGraph: {
            title: displayTitle,
            description,
            url: absoluteUrl(canonical),
            images: paper.thumbNailUrl ? [{ url: paper.thumbNailUrl }] : [],
        },
        twitter: {
            card: "summary_large_image",
            title: displayTitle,
            description,
            images: paper.thumbNailUrl ? [paper.thumbNailUrl] : [],
        },
        alternates: { canonical },
        keywords,
        robots: { index: true, follow: true },
    };
}
