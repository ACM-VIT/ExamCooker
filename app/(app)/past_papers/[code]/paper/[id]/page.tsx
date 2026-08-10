import React, { Suspense } from 'react';
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PageBreadcrumbRow from "@/app/components/common/page-breadcrumb-row";
import PDFViewerClient from '@/app/components/pdf-viewer-client';
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import DirectionalTransition from "@/app/components/common/directional-transition";
import RecentPaperStrip from "@/app/components/past_papers/recent-paper-strip";
import ShareLink from '@/app/components/share-link';
import ViewTracker from "@/app/components/view-tracker";
import { LazyPastPaperInlineEditor } from "@/app/components/moderation/lazy-editors";
import {
    getAdjacentPapersInCourse,
    getPastPaperDetail,
    getSiblingPastPaper,
    getRelatedPapersForCourse,
} from "@/lib/data/past-paper-detail";
// import PastPaperTagEditor from "@/app/components/past-paper-tag-editor";
import { absoluteUrl, buildKeywords, DEFAULT_KEYWORDS, getPastPaperDetailPath } from "@/lib/seo";
import { normalizeCourseCode } from "@/lib/course-tags";
import { examTypeLabel } from "@/lib/exam-slug";
import { buildPastPaperPdfFileName } from "@/lib/downloads/resource-names";
import type { ExamType } from "@/db";
import DocumentViewerShell from "@/app/components/common/document-viewer-shell";
import { getExamFocusForDate } from "@/lib/exam-focus";
import { getUpcomingExamsForCourses } from "@/lib/data/upcoming-exams";
import {
    buildPastPaperSearchString,
    getCoursePaperFilters,
    parsePastPaperSearchParams,
    type PastPaperSearchParams,
} from "@/lib/past-paper-search-params";

export const instant = true;

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
const NON_LETTER_REGEX = /[^A-Za-z]/g;
const ACRONYM_WORD_SPLIT_REGEX = /[\s/-]+/;
const UPPERCASE_INITIAL_REGEX = /^[A-Z]/;

function buildCourseAcronym(courseTitle: string): string {
    const acronym: string[] = [];
    for (const rawWord of courseTitle.replace(/\[[^\]]+\]/g, " ").split(ACRONYM_WORD_SPLIT_REGEX)) {
        const word = rawWord.replace(NON_LETTER_REGEX, "");
        if (!word || !UPPERCASE_INITIAL_REGEX.test(word) || ACRONYM_SKIP_WORDS.has(word.toLowerCase())) {
            continue;
        }

        acronym.push(word[0]?.toUpperCase() ?? "");
    }

    return acronym.join("");
}

function getHeadingTitle(courseTitle: string): string {
    const acronym = buildCourseAcronym(courseTitle);
    const isLikelyToWrap = courseTitle.length > 30 || courseTitle.split(/\s+/).length > 4;

    return isLikelyToWrap && acronym.length >= 2 ? acronym : courseTitle;
}

async function getCourseExamFocus(courseId: string): Promise<ExamType> {
    const upcomingExamsByCourse = await getUpcomingExamsForCourses([courseId]);
    return (
        upcomingExamsByCourse
            .get(courseId)
            ?.find((exam) => exam.examType !== null)?.examType ??
        getExamFocusForDate(new Date())
    );
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
                prefetch
                transitionTypes={[isPrev ? "nav-back" : "nav-forward"]}
                aria-label={tooltip}
                title={tooltip}
                className="relative inline-flex size-full items-center justify-center border-2 border-black bg-[#3BF4C7] text-black transition duration-150 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:-translate-x-1 dark:group-hover:-translate-y-1 dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7]"
            >
                {isPrev ? (
                    <ChevronLeft
                        className="size-5 transition-transform group-hover:-translate-x-0.5"
                        strokeWidth={2.5}
                    />
                ) : (
                    <ChevronRight
                        className="size-5 transition-transform group-hover:translate-x-0.5"
                        strokeWidth={2.5}
                    />
                )}
            </Link>
        </div>
    );
}

async function PaperViewerContent({
    paramsPromise,
    searchParamsPromise,
}: {
    paramsPromise: Promise<{ code: string; id: string }>;
    searchParamsPromise?: Promise<PastPaperSearchParams>;
}) {
    const { code, id } = await paramsPromise;
    const rawSearchParams = (await searchParamsPromise) ?? {};
    const parsedSearchParams = parsePastPaperSearchParams(rawSearchParams);
    const coursePaperFilters = getCoursePaperFilters(parsedSearchParams);
    const searchString = buildPastPaperSearchString(rawSearchParams);
    const siblingSearchString = buildPastPaperSearchString({
        sort: rawSearchParams.sort,
    });

    const paper = await getPastPaperDetail(id);
    if (!paper) return notFound();

    const canonicalCode = paper.course?.code ?? "unassigned";

    if (normalizeCourseCode(code) !== canonicalCode && code !== canonicalCode) {
        const canonicalPath = getPastPaperDetailPath(paper.id, canonicalCode);
        permanentRedirect(searchString ? `${canonicalPath}?${searchString}` : canonicalPath);
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
    const courseId = paper.courseId;

    const relatedPapersPromise = courseId
        ? getRelatedPapersForCourse({
              paperId: paper.id,
              courseId,
              examType: paper.examType,
              limit: 8,
          })
        : Promise.resolve([]);
    const siblingPaperPromise = courseId
        ? getSiblingPastPaper({
              paperId: paper.id,
              questionPaperId: paper.questionPaperId,
              courseId,
              examType: paper.examType,
              slot: paper.slot,
              year: paper.year,
              semester: paper.semester,
              campus: paper.campus,
              hasAnswerKey: paper.hasAnswerKey,
          })
        : Promise.resolve(null);
    const adjacentPapersPromise = courseId
        ? parsedSearchParams.sort === "seasonal"
            ? getCourseExamFocus(courseId).then((examFocus) =>
                  getAdjacentPapersInCourse({
                      paperId: paper.id,
                      courseId,
                      filters: coursePaperFilters,
                      sort: "seasonal",
                      examFocus,
                  }),
              )
            : getAdjacentPapersInCourse({
                  paperId: paper.id,
                  courseId,
                  filters: coursePaperFilters,
                  sort: parsedSearchParams.sort,
              })
        : Promise.resolve({ prev: null, next: null });
    const [relatedPapers, siblingPaper, adjacentPapers] = await Promise.all([
        relatedPapersPromise,
        siblingPaperPromise,
        adjacentPapersPromise,
    ]);

    const relatedItems = relatedPapers.map((item) => ({
        id: item.id,
        title: item.title,
        thumbNailUrl: item.thumbNailUrl,
        courseCode: item.course?.code ?? null,
        courseTitle: item.course?.title ?? null,
        examType: item.examType,
        slot: item.slot,
        year: item.year,
    }));

    const metaPills: Array<{ className?: string; value: string }> = [];
    if (displayExam) metaPills.push({ value: displayExam });
    if (displaySlot) metaPills.push({ value: displaySlot });
    if (displayYear) metaPills.push({ value: displayYear });
    if (paper.course?.code) metaPills.push({ className: "hidden sm:inline-flex", value: paper.course.code });

    const appendSearchString = (href: string, queryString = searchString) =>
        queryString ? `${href}?${queryString}` : href;
    const courseHref = appendSearchString(`/past_papers/${canonicalCode}`);
    const backLabel = paper.course?.code ?? "Past papers";

    const buildSideNavHref = (
        item: NonNullable<typeof adjacentPapers.prev> | NonNullable<typeof adjacentPapers.next>,
    ) => appendSearchString(`/past_papers/${canonicalCode}/paper/${item.id}`);

    return (
        <>
            <ViewTracker id={paper.id} type="pastpaper" title={displayTitle} />

                <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 pb-10 pt-4 sm:gap-5 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 xl:px-10">
                    <PageBreadcrumbRow
                        items={[{ href: courseHref, label: backLabel }]}
                    />

                    <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-pretty text-2xl font-bold leading-[1.15] tracking-tight sm:text-3xl lg:text-4xl">
                                {headingTitle}
                                <LazyPastPaperInlineEditor
                                    paperId={paper.id}
                                    canonicalCode={canonicalCode}
                                    initialTitle={paper.title}
                                    initialCourseId={paper.courseId}
                                    initialExamType={paper.examType}
                                    initialSlot={paper.slot}
                                    initialYear={paper.year}
                                    initialSemester={paper.semester}
                                    initialCampus={paper.campus}
                                    initialHasAnswerKey={paper.hasAnswerKey}
                                    initialQuestionPaper={paper.hasAnswerKey ? siblingPaper : null}
                                    initialTags={paper.tags.map((tag) => tag.name)}
                                />
                            </h1>
                            {metaPills.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {metaPills.map(({ className, value }) => (
                                        <span
                                            key={value}
                                            className={`inline-flex items-center border border-black/12 bg-white px-2.5 py-1 text-xs font-medium text-black/75 dark:border-[#D5D5D5]/12 dark:bg-[#0C1222] dark:text-[#D5D5D5]/80 ${className ?? ""}`}
                                        >
                                            <span>{value}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:pt-1">
                            {siblingPaper ? (
                                <Link
                                    href={appendSearchString(
                                        getPastPaperDetailPath(
                                            siblingPaper.id,
                                            siblingPaper.course?.code ?? canonicalCode,
                                        ),
                                        siblingSearchString,
                                    )}
                                    prefetch
                                    transitionTypes={["nav-forward"]}
                                    className="inline-flex items-center justify-center border border-black/15 bg-white px-3 py-2 text-sm font-semibold text-black transition hover:border-black/30 hover:bg-black/5 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#D5D5D5]/30 dark:hover:bg-white/5"
                                >
                                    {siblingPaper.hasAnswerKey ? "Answer key" : "Question paper"}
                                </Link>
                            ) : null}
                            <ShareLink
                                fileType="this Past Paper"
                                resourceTitle={displayTitle}
                                resourceKind="paper"
                            />
                        </div>
                    </header>

                    <div className="relative">
                        {adjacentPapers.prev && (
                            <PaperNavButton
                                direction="prev"
                                href={buildSideNavHref(adjacentPapers.prev)}
                                year={adjacentPapers.prev.year}
                                examType={adjacentPapers.prev.examType}
                                slot={adjacentPapers.prev.slot}
                            />
                        )}
                        {adjacentPapers.next && (
                            <PaperNavButton
                                direction="next"
                                href={buildSideNavHref(adjacentPapers.next)}
                                year={adjacentPapers.next.year}
                                examType={adjacentPapers.next.examType}
                                slot={adjacentPapers.next.slot}
                            />
                        )}
                        <div className="overflow-hidden border border-black/15 bg-white shadow-[0_4px_28px_-14px_rgba(0,0,0,0.25)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:shadow-[0_4px_28px_-14px_rgba(0,0,0,0.6)]">
                            <div className="h-[70dvh] sm:h-[78dvh] lg:h-[84dvh] xl:h-[86dvh]">
                                <PDFViewerClient
                                    enableQuestionMarkdown
                                    fileUrl={paper.fileUrl}
                                    fileName={downloadFileName}
                                    pageEdits={paper.pageEdits}
                                    moderation={{
                                        paperId: paper.id,
                                        pageEdits: paper.pageEdits,
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {relatedItems.length > 0 && (
                        <RecentPaperStrip
                            items={relatedItems}
                            title="Related papers"
                        />
                    )}
                </div>
        </>
    );
}

function PdfViewerPage({
    params,
    searchParams,
}: {
    params: Promise<{ code: string; id: string }>;
    searchParams?: Promise<PastPaperSearchParams>;
}) {
    return (
        <DirectionalTransition>
            <div className="min-h-dvh bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <Suspense fallback={<DocumentViewerShell kind="paper" />}>
                    <PaperViewerContent paramsPromise={params} searchParamsPromise={searchParams} />
                </Suspense>
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
    if (!paper) return { robots: { index: false, follow: true } };

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
