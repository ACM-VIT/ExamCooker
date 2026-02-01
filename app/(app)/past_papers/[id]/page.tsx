import React from 'react';
import PDFViewerClient from '@/app/components/PDFViewerClient';
import {TimeHandler} from '@/app/components/forumpost/CommentContainer';
import {Metadata} from "next";
import {notFound} from "next/navigation";
import PastPaperCard from "@/app/components/PastPaperCard";

import ShareLink from '@/app/components/ShareLink';
import ViewTracker from "@/app/components/ViewTracker";
import { getPastPaperDetail } from "@/lib/data/pastPaperDetail";
import ItemActions from "@/app/components/ItemActions";
import TagContainer from "@/app/components/forumpost/TagContainer";
import PastPaperTagEditor from "@/app/components/PastPaperTagEditor";
import { absoluteUrl, buildKeywords, DEFAULT_KEYWORDS } from "@/lib/seo";
import { extractCourseFromTag } from "@/lib/courseTags";
import { getRelatedPastPapers } from "@/lib/data/pastPapers";
import { parsePaperTitle } from "@/lib/paperTitle";
import { getRelatedPastPapersByCourseCode } from "@/lib/data/pastPapers";
import prisma from "@/lib/prisma";
import { auth } from "@/app/auth";

function isValidSlot(str: string): boolean {
    const regex = /^[A-G]\d$/;
    return regex.test(str);
}

function isValidYear(year: string): boolean {
    const regex = /^20\d{2}$/;
    return regex.test(year);
}

async function PdfViewerPage({params}: {params: Promise<{ id: string }>}) {
    let paper;
    let year: string = '';
    let slot: string = '';
    const { id } = await params;

    let allTags: Array<{ name: string }> = [];

    try {
        [paper, allTags] = await Promise.all([
            getPastPaperDetail(id),
            prisma.tag.findMany({ select: { name: true } }),
        ]);

        if (paper) {
            for (let i: number = 0; i < paper!.tags.length; i++) {
                if (isValidYear(paper!.tags[i].name)) {
                    year = paper!.tags[i].name
                } else if (isValidSlot(paper!.tags[i].name)) {
                    slot = paper!.tags[i].name
                }
            }
        }
    } catch (error) {
        console.error('Error fetching note:', error);
        return (
            <div>
                <div className="text-center p-8 dark:text-[#d5d5d5]">Error loading paper. Please refresh, or try again
                    later.
                </div>
                {/* <div><FontAwesomeIcon icon={faArrowLeft}/>Go Back</div> */}
            </div>
        );
    } finally {
        // no-op
    }

    if (!paper) return notFound();

    const session = await auth();
    const isModerator = (session?.user as { role?: string } | undefined)?.role === "MODERATOR";

    const postTime: string = paper.createdAt.toLocaleString("en-US", {timeZone: "Asia/Kolkata"});

    const parsedTitle = parsePaperTitle(paper.title);
    const courseTags = paper.tags.filter((tag) => extractCourseFromTag(tag.name));
    const courseFromTag = courseTags.length ? extractCourseFromTag(courseTags[0].name) : null;
    const parsedCourseCode = parsedTitle.courseCode?.replace(/\s+/g, "").toUpperCase();
    const taggedCourseCode = courseFromTag?.code?.replace(/\s+/g, "").toUpperCase();
    const useParsedCourse = Boolean(
        parsedCourseCode && (!taggedCourseCode || parsedCourseCode !== taggedCourseCode)
    );
    const courseTitle = useParsedCourse
        ? parsedTitle.courseName ?? parsedTitle.cleanTitle
        : courseFromTag?.title ?? parsedTitle.courseName ?? parsedTitle.cleanTitle;
    const courseCode = useParsedCourse ? parsedCourseCode : courseFromTag?.code ?? parsedCourseCode;
    const displayTitle = courseCode && !courseTitle.toUpperCase().includes(courseCode)
        ? `${courseTitle} (${courseCode})`
        : courseTitle;
    const displaySlot = parsedTitle.slot ?? slot;
    const displayYear = parsedTitle.academicYear ?? parsedTitle.year ?? year;
    const examType = parsedTitle.examType;
    const courseTagIds = courseTags.map((tag) => tag.id);
    const relatedPapers = courseTagIds.length
        ? await getRelatedPastPapers({
              id: paper.id,
              tagIds: courseTagIds,
              examType,
              limit: 6,
          })
        : courseCode
            ? await getRelatedPastPapersByCourseCode({
                  id: paper.id,
                  courseCode,
                  examType,
                  limit: 6,
              })
            : [];
    const canonical = `/past_papers/${paper.id}`;
    const keywords = buildKeywords(
        DEFAULT_KEYWORDS,
        paper.tags.map((tag) => tag.name)
    );
    const description = `View ${displayTitle} past paper on ExamCooker.`;
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: displayTitle,
        description,
        url: absoluteUrl(canonical),
        datePublished: paper.createdAt.toISOString(),
        dateModified: paper.updatedAt.toISOString(),
        keywords: keywords.join(", "),
        author: paper.author?.name ? { "@type": "Person", name: paper.author.name } : undefined,
    };

    const relatedSection = relatedPapers.length ? (
        <div className="space-y-3">
            <h2 className="text-lg font-semibold">Related past papers</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedPapers.map((item, index) => (
                    <PastPaperCard
                        key={item.id}
                        pastPaper={item}
                        index={index}
                    />
                ))}
            </div>
        </div>
    ) : null;

    return (
        <div className="flex flex-col lg:flex-row lg:h-screen text-black dark:text-[#D5D5D5]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ViewTracker
                id={paper.id}
                type="pastpaper"
                title={displayTitle}
            />
            <div className="lg:w-1/2 flex flex-col overflow-hidden">
                <div className="lg:flex-grow lg:overflow-y-auto p-2 sm:p-4 lg:p-8">
                    <div className="max-w-2xl mx-auto">
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">{displayTitle}</h1>
                        <div className="space-y-2 sm:space-y-3">
                            <p className="text-base sm:text-lg"><span className="font-semibold">Slot:</span> {displaySlot}</p>
                            <p className="text-base sm:text-lg"><span className="font-semibold">Year:</span> {displayYear}</p>
                            <p className="text-base sm:text-lg"><span
                                className="font-semibold">Posted by: </span> {paper.author?.name?.slice(0, -10) || 'Unknown'}
                            </p>
                            {courseTags.length ? (
                                <div className="pt-2">
                                    <TagContainer tags={courseTags} />
                                </div>
                            ) : null}
                            {isModerator ? (
                                <PastPaperTagEditor
                                    paperId={paper.id}
                                    initialTags={paper.tags.map((tag) => tag.name)}
                                    allTags={allTags.map((tag) => tag.name)}
                                />
                            ) : null}
                            {relatedSection ? (
                                <div className="hidden lg:block pt-6">
                                    {relatedSection}
                                </div>
                            ) : null}
                            <div className="flex gap-2 items-center justify-between">
                                <p className='text-base sm:text-xs'><span
                                    className="font-semibold">Posted at: {TimeHandler(postTime).hours}:{TimeHandler(postTime).minutes}{TimeHandler(postTime).amOrPm}, {TimeHandler(postTime).day}-{TimeHandler(postTime).month}-{TimeHandler(postTime).year}</span>
                                </p>
                                <ItemActions
                                    itemId={paper.id}
                                    title={paper.title}
                                    authorId={paper.author?.id}
                                    activeTab="pastPaper"
                                />
                                <ShareLink fileType='this Past Paper'/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="lg:flex-1 lg:w-1/2 overflow-hidden lg:border-l lg:border-black dark:lg:border-[#D5D5D5] p-2 sm:p-4">
                <div className="h-[70vh] sm:h-[75vh] lg:h-full overflow-auto">
                    <PDFViewerClient fileUrl={paper.fileUrl}/>
                </div>
            </div>
            {relatedSection ? (
                <div className="px-2 sm:px-4 pb-4 sm:pb-6 lg:hidden">
                    {relatedSection}
                </div>
            ) : null}
        </div>
    );
}

export default PdfViewerPage;


export async function generateMetadata({params}: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const paper = await getPastPaperDetail(id);
    if (!paper) return {}
    const parsedTitle = parsePaperTitle(paper.title);
    const courseTags = paper.tags.filter((tag) => extractCourseFromTag(tag.name));
    const courseFromTag = courseTags.length ? extractCourseFromTag(courseTags[0].name) : null;
    const parsedCourseCode = parsedTitle.courseCode?.replace(/\s+/g, "").toUpperCase();
    const taggedCourseCode = courseFromTag?.code?.replace(/\s+/g, "").toUpperCase();
    const useParsedCourse = Boolean(
        parsedCourseCode && (!taggedCourseCode || parsedCourseCode !== taggedCourseCode)
    );
    const courseTitle = useParsedCourse
        ? parsedTitle.courseName ?? parsedTitle.cleanTitle
        : courseFromTag?.title ?? parsedTitle.courseName ?? parsedTitle.cleanTitle;
    const courseCode = useParsedCourse ? parsedCourseCode : courseFromTag?.code ?? parsedCourseCode;
    const title = courseCode && !courseTitle.toUpperCase().includes(courseCode)
        ? `${courseTitle} (${courseCode})`
        : courseTitle;
    const canonical = `/past_papers/${paper.id}`;
    const description = `View ${title} past paper on ExamCooker.`;
    const keywords = buildKeywords(
        DEFAULT_KEYWORDS,
        paper.tags.map((tag) => tag.name)
    );
    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: canonical,
            images: paper.thumbNailUrl ? [{url: paper.thumbNailUrl}] : []
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: paper.thumbNailUrl ? [paper.thumbNailUrl] : [],
        },
        alternates: { canonical },
        keywords,
        robots: { index: true, follow: true },
    }
}
