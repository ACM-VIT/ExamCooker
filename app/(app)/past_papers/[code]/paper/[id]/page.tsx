import React from 'react';
import PDFViewerClient from '@/app/components/PDFViewerClient';
import { TimeHandler } from '@/app/components/forumpost/CommentHelpers';
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import PastPaperCard from "@/app/components/PastPaperCard";
import ShareLink from '@/app/components/ShareLink';
import ViewTracker from "@/app/components/ViewTracker";
import { getPastPaperDetail, getRelatedPapersForCourse } from "@/lib/data/pastPaperDetail";
import ItemActions from "@/app/components/ItemActions";
// import PastPaperTagEditor from "@/app/components/PastPaperTagEditor";
import { absoluteUrl, buildKeywords, DEFAULT_KEYWORDS, getPastPaperDetailPath } from "@/lib/seo";
import { normalizeCourseCode } from "@/lib/courseTags";
import { examTypeLabel } from "@/lib/examSlug";
import prisma from "@/lib/prisma";
import { auth } from "@/app/auth";

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

async function PdfViewerPage({ params }: { params: Promise<{ code: string; id: string }> }) {
    const { code, id } = await params;

    const paper = await getPastPaperDetail(id);
    if (!paper) return notFound();

    const canonicalCode = paper.course?.code ?? "unassigned";

    if (normalizeCourseCode(code) !== canonicalCode && code !== canonicalCode) {
        permanentRedirect(getPastPaperDetailPath(paper.id, canonicalCode));
    }

    const session = await auth();
    const isModerator = (session?.user as { role?: string } | undefined)?.role === "MODERATOR";
    let allTags: Array<{ name: string }> = [];
    if (isModerator) {
        try {
            allTags = await prisma.tag.findMany({ select: { name: true } });
        } catch (error) {
            console.error("Error fetching tags:", error);
        }
    }

    const postTime = paper.createdAt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const displayTitle = paper.course?.title ?? paper.title.replace(/\.pdf$/i, "");
    const headingTitle = paper.course?.title ? getHeadingTitle(paper.course.title) : displayTitle;
    const displaySlot = paper.slot ?? undefined;
    const displayYear = paper.year?.toString() ?? undefined;
    const displayExam = paper.examType ? examTypeLabel(paper.examType) : undefined;

    const relatedPapers = paper.courseId
        ? await getRelatedPapersForCourse({
              paperId: paper.id,
              courseId: paper.courseId,
              examType: paper.examType,
              limit: 6,
          })
        : [];

    const relatedSection = relatedPapers.length ? (
        <div className="space-y-3">
            <h2 className="text-lg font-semibold">Related past papers</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedPapers.map((item, index) => (
                    <PastPaperCard
                        key={item.id}
                        pastPaper={item}
                        index={index}
                        transitionTypes={false}
                    />
                ))}
            </div>
        </div>
    ) : null;

    return (
        <DirectionalTransition>
            <div className="min-h-dvh flex flex-col text-black dark:text-[#D5D5D5] lg:h-screen lg:flex-row">
                <ViewTracker id={paper.id} type="pastpaper" title={displayTitle} />
                <div className="flex flex-col lg:w-1/2 lg:overflow-hidden">
                    <div className="lg:flex-grow lg:overflow-y-auto p-2 sm:p-4 lg:p-8">
                        <div className="max-w-2xl mx-auto">
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">{headingTitle}</h1>
                            <div className="space-y-2 sm:space-y-3">
                                {displaySlot && (
                                    <p className="text-base sm:text-lg"><span className="font-semibold">Slot:</span> {displaySlot}</p>
                                )}
                                {displayYear && (
                                    <p className="text-base sm:text-lg"><span className="font-semibold">Year:</span> {displayYear}</p>
                                )}
                                {displayExam && (
                                    <p className="text-base sm:text-lg"><span className="font-semibold">Exam:</span> {displayExam}</p>
                                )}
                                <p className="text-base sm:text-lg">
                                    <span className="font-semibold">Posted by: </span>
                                    {paper.author?.name?.slice(0, -10) || 'Unknown'}
                                </p>
                                {/* {isModerator && (
                                    <PastPaperTagEditor
                                        paperId={paper.id}
                                        initialTags={paper.tags.map((tag) => tag.name)}
                                        allTags={allTags.map((tag) => tag.name)}
                                    />
                                )} */}
                                {relatedSection ? (
                                    <div className="hidden lg:block pt-6">{relatedSection}</div>
                                ) : null}
                                <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm leading-relaxed sm:text-xs sm:leading-normal">
                                        <span className="font-semibold">
                                            Posted at: {TimeHandler(postTime).hours}:{TimeHandler(postTime).minutes}{TimeHandler(postTime).amOrPm}, {TimeHandler(postTime).day}-{TimeHandler(postTime).month}-{TimeHandler(postTime).year}
                                        </span>
                                    </p>
                                    <div className="flex items-center justify-end gap-3 sm:justify-start">
                                        <ItemActions
                                            itemId={paper.id}
                                            title={paper.title}
                                            authorId={paper.author?.id}
                                            activeTab="pastPaper"
                                        />
                                        <ShareLink fileType='this Past Paper' />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="lg:flex-1 lg:w-1/2 overflow-hidden lg:border-l lg:border-black dark:lg:border-[#D5D5D5] p-2 sm:p-4">
                    <div className="h-[68dvh] max-h-[80dvh] overflow-hidden sm:h-[75vh] lg:h-full lg:max-h-none">
                        <PDFViewerClient fileUrl={paper.fileUrl} />
                    </div>
                </div>
                {relatedSection ? (
                    <div className="px-2 sm:px-4 pb-4 sm:pb-6 lg:hidden">{relatedSection}</div>
                ) : null}
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
