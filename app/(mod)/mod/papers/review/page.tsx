import React, { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { auth } from "@/app/auth";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import PaperReviewList from "@/app/components/mod/paper-review-list";
import type { CourseOption } from "@/app/components/mod/course-picker";
import type { PaperRowData } from "@/app/components/mod/paper-review-row";
import type { PaperLinkOption } from "@/app/components/mod/paper-link-types";
import { course, db, pastPaper } from "@/db";

export const metadata = {
    title: "Paper metadata review · Mod",
};

function PaperReviewShell() {
    return (
        <div
            className="flex min-h-screen items-center justify-center bg-[#F5FAFD] dark:bg-transparent"
            aria-hidden="true"
        >
            <div className="h-8 w-8 animate-spin border-2 border-black border-t-transparent dark:border-[#D5D5D5] dark:border-t-transparent" />
        </div>
    );
}

async function PaperReviewContent() {
    const session = await auth();
    if (!session?.user) redirect("/");
    if (session.user.role !== "MODERATOR") notFound();

    const [papers, courses] = await Promise.all([
        db
            .select({
                id: pastPaper.id,
                title: pastPaper.title,
                thumbNailUrl: pastPaper.thumbNailUrl,
                isClear: pastPaper.isClear,
                courseId: pastPaper.courseId,
                examType: pastPaper.examType,
                slot: pastPaper.slot,
                year: pastPaper.year,
                semester: pastPaper.semester,
                campus: pastPaper.campus,
                hasAnswerKey: pastPaper.hasAnswerKey,
                questionPaperId: pastPaper.questionPaperId,
            })
            .from(pastPaper)
            .where(
                or(
                    eq(pastPaper.isClear, false),
                    isNull(pastPaper.courseId),
                    isNull(pastPaper.examType),
                    isNull(pastPaper.year),
                    and(eq(pastPaper.hasAnswerKey, true), isNull(pastPaper.questionPaperId)),
                ),
            )
            .orderBy(desc(pastPaper.createdAt))
            .limit(100),
        db
            .select({
                id: course.id,
                code: course.code,
                title: course.title,
                aliases: course.aliases,
            })
            .from(course)
            .orderBy(course.code)
            .limit(500),
    ]);

    const linkedQuestionPaperIds = [
        ...new Set(
            papers
                .map((paper) => paper.questionPaperId)
                .filter((questionPaperId): questionPaperId is string => questionPaperId !== null),
        ),
    ];

    const linkedQuestionPapers = linkedQuestionPaperIds.length
        ? await db
              .select({
                  id: pastPaper.id,
                  title: pastPaper.title,
                  courseCode: course.code,
                  courseTitle: course.title,
                  examType: pastPaper.examType,
                  slot: pastPaper.slot,
                  year: pastPaper.year,
                  hasAnswerKey: pastPaper.hasAnswerKey,
              })
              .from(pastPaper)
              .leftJoin(course, eq(pastPaper.courseId, course.id))
              .where(inArray(pastPaper.id, linkedQuestionPaperIds))
        : [];

    const linkedQuestionPaperMap = new Map<string, PaperLinkOption>(
        linkedQuestionPapers.map((paper) => [
            paper.id,
            {
                id: paper.id,
                title: paper.title,
                courseCode: paper.courseCode,
                courseTitle: paper.courseTitle,
                examType: paper.examType,
                slot: paper.slot,
                year: paper.year,
                hasAnswerKey: paper.hasAnswerKey,
            },
        ]),
    );

    const rows: PaperRowData[] = papers.map((p) => ({
        ...p,
        thumbNailUrl: normalizeGcsUrl(p.thumbNailUrl) ?? p.thumbNailUrl,
        questionPaper: p.questionPaperId
            ? linkedQuestionPaperMap.get(p.questionPaperId) ?? null
            : null,
    }));
    const courseOptions: CourseOption[] = courses.map((row) => ({
        ...row,
        aliases: row.aliases ?? [],
    }));

    return (
        <div className="min-h-screen bg-[#F5FAFD] px-3 py-6 text-black dark:bg-transparent dark:text-[#D5D5D5] sm:px-6 lg:px-10">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <header className="flex flex-wrap items-end justify-between gap-3 border-b border-black/20 pb-4 dark:border-[#D5D5D5]/20">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60">
                            Moderator
                        </p>
                        <h1 className="text-2xl font-bold">Paper metadata review</h1>
                        <p className="mt-1 text-sm text-black/70 dark:text-[#D5D5D5]/70">
                            Papers missing course, exam, year, or an answer-key link. Fill in
                            the gaps and save; once the row is complete it drops off the queue
                            automatically.
                        </p>
                    </div>
                    <Link
                        href="/mod"
                        className="border border-black/30 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-black/5 dark:border-[#D5D5D5]/40 dark:text-[#D5D5D5] dark:hover:bg-white/5"
                    >
                        ← Back to dashboard
                    </Link>
                </header>

                <PaperReviewList initialPapers={rows} courses={courseOptions} />
            </div>
        </div>
    );
}

export default function PaperReviewPage() {
    return (
        <Suspense fallback={<PaperReviewShell />}>
            <PaperReviewContent />
        </Suspense>
    );
}
