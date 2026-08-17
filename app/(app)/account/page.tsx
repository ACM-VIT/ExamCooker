import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/app/auth";
import {
    contentCorrectionReport,
    course,
    db,
    pastPaper,
} from "@/db";
import type { AiModerationReview } from "@/lib/ai/moderation-review-types";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import { getPastPaperDetailPath } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Account",
    description: "View the past papers you have uploaded and their review status.",
    alternates: { canonical: "/account" },
    robots: { index: false, follow: false },
};

type UploadStatusTone = "neutral" | "info" | "warning" | "danger" | "success";
type CorrectionArchiveAction = "withdrawn" | "converted" | null;

type UploadStatus = {
    label: string;
    description: string;
    tone: UploadStatusTone;
};

type PaperStatusInput = {
    aiReview: AiModerationReview | null;
    correctionAction: CorrectionArchiveAction;
    isClear: boolean;
    moderationArchivedAt: Date | null;
};

const statusClassNames: Record<UploadStatusTone, string> = {
    neutral: "border-black/15 bg-black/5 text-black/70 dark:border-white/15 dark:bg-white/5 dark:text-white/70",
    info: "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-200",
    warning: "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-200",
    danger: "border-red-500/35 bg-red-500/10 text-red-800 dark:text-red-200",
    success: "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
};

function getUploadStatus({
    aiReview,
    correctionAction,
    isClear,
    moderationArchivedAt,
}: PaperStatusInput): UploadStatus {
    if (isClear) {
        return {
            label: "Published",
            description: "Approved and visible in the past-paper library.",
            tone: "success",
        };
    }

    if (moderationArchivedAt) {
        if (correctionAction === "converted") {
            return {
                label: "Moved to notes",
                description:
                    "This upload was reclassified and moved to the notes collection after a correction review.",
                tone: "info",
            };
        }

        if (correctionAction === "withdrawn") {
            return {
                label: "Withdrawn",
                description:
                    "Previously published, then removed from the library after a correction review.",
                tone: "warning",
            };
        }

        if (aiReview?.status === "duplicate") {
            return {
                label: "Duplicate",
                description: "Removed from review because the paper already exists.",
                tone: "warning",
            };
        }

        return {
            label: "Rejected",
            description: "Removed from the moderation queue without being published.",
            tone: "danger",
        };
    }

    if (!aiReview) {
        return {
            label: "Uploaded",
            description: "Stored successfully and waiting for the automated review.",
            tone: "neutral",
        };
    }

    if (aiReview.status === "needs_changes") {
        return {
            label: "Needs changes",
            description: "The automated review found metadata or document issues for a moderator to check.",
            tone: "warning",
        };
    }

    if (aiReview.status === "duplicate") {
        return {
            label: "Duplicate detected",
            description: "The automated review found a likely match in the existing library.",
            tone: "warning",
        };
    }

    if (aiReview.status === "failed") {
        return {
            label: "In review",
            description: "The automated check could not finish; the paper remains available to moderators.",
            tone: "info",
        };
    }

    return {
        label: "In review",
        description: "The automated check is complete and the paper is awaiting final publication.",
        tone: "info",
    };
}

function formatExamType(value: string | null) {
    return value?.replaceAll("_", "-") ?? "Exam type unknown";
}

function formatSemester(value: string) {
    return value === "UNKNOWN"
        ? "Semester unknown"
        : `${value.charAt(0)}${value.slice(1).toLowerCase()} semester`;
}

function formatUploadedAt(value: Date) {
    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
    }).format(value);
}

export default async function AccountPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/signin?callbackUrl=/account");
    }

    const uploads = await db
        .select({
            id: pastPaper.id,
            title: pastPaper.title,
            fileUrl: pastPaper.fileUrl,
            createdAt: pastPaper.createdAt,
            isClear: pastPaper.isClear,
            moderationArchivedAt: pastPaper.moderationArchivedAt,
            aiReview: pastPaper.aiReview,
            examType: pastPaper.examType,
            semester: pastPaper.semester,
            slot: pastPaper.slot,
            year: pastPaper.year,
            courseCode: course.code,
            courseTitle: course.title,
        })
        .from(pastPaper)
        .leftJoin(course, eq(pastPaper.courseId, course.id))
        .where(eq(pastPaper.authorId, session.user.id))
        .orderBy(desc(pastPaper.createdAt))
        .limit(100);

    const archivedUploadIds = uploads
        .filter((upload) => upload.moderationArchivedAt !== null)
        .map((upload) => upload.id);
    const correctionReports =
        archivedUploadIds.length === 0
            ? []
            : await db
                  .select({
                      pastPaperId: contentCorrectionReport.pastPaperId,
                      aiDecision: contentCorrectionReport.aiDecision,
                  })
                  .from(contentCorrectionReport)
                  .where(
                      and(
                          inArray(
                              contentCorrectionReport.pastPaperId,
                              archivedUploadIds,
                          ),
                          inArray(contentCorrectionReport.status, [
                              "approved",
                              "auto_approved",
                          ]),
                      ),
                  )
                  .orderBy(desc(contentCorrectionReport.resolvedAt));

    const correctionActions = new Map<string, Exclude<CorrectionArchiveAction, null>>();
    for (const report of correctionReports) {
        if (!report.pastPaperId || correctionActions.has(report.pastPaperId)) {
            continue;
        }

        const appliedFields = report.aiDecision?.appliedFields ?? [];
        if (appliedFields.includes("resourceType")) {
            correctionActions.set(report.pastPaperId, "converted");
        } else if (appliedFields.includes("visibility")) {
            correctionActions.set(report.pastPaperId, "withdrawn");
        }
    }

    return (
        <main className="min-h-screen bg-[#C2E6EC] px-4 py-8 text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5] sm:px-8 lg:px-12">
            <div className="mx-auto w-full max-w-5xl space-y-8">
                <header className="border-b border-black/10 pb-6 dark:border-white/10">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/55">
                        Account
                    </p>
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                                Your uploads
                            </h1>
                            <p className="mt-2 text-sm text-black/60 dark:text-white/60">
                                {session.user.email}
                            </p>
                        </div>
                        <div className="flex gap-3 text-sm font-semibold">
                            <Link
                                href="/past_papers/create"
                                className="border-2 border-black bg-[#3BF4C7] px-4 py-2 text-black transition hover:-translate-y-0.5"
                            >
                                Upload a paper
                            </Link>
                            <a
                                href="/account"
                                className="border-2 border-black/25 px-4 py-2 transition hover:border-black dark:border-white/25 dark:hover:border-white"
                            >
                                Refresh
                            </a>
                        </div>
                    </div>
                </header>

                {uploads.length === 0 ? (
                    <section className="border-2 border-dashed border-black/20 bg-white/55 p-8 text-center dark:border-white/20 dark:bg-white/5">
                        <h2 className="text-xl font-bold">No past papers uploaded yet</h2>
                        <p className="mx-auto mt-2 max-w-md text-sm text-black/60 dark:text-white/60">
                            Papers you submit will appear here immediately, followed by their automated and moderator review status.
                        </p>
                    </section>
                ) : (
                    <section aria-label="Uploaded past papers" className="space-y-4">
                        {uploads.map((paper) => {
                            const status = getUploadStatus({
                                ...paper,
                                correctionAction:
                                    correctionActions.get(paper.id) ?? null,
                            });
                            const fileUrl = normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl;
                            const metadata = [
                                paper.courseCode
                                    ? `${paper.courseCode}${paper.courseTitle ? ` · ${paper.courseTitle}` : ""}`
                                    : paper.courseTitle ?? "Course unassigned",
                                formatExamType(paper.examType),
                                paper.slot ? `Slot ${paper.slot}` : null,
                                paper.year?.toString() ?? null,
                                formatSemester(paper.semester),
                            ].filter(Boolean);

                            return (
                                <article
                                    key={paper.id}
                                    className="border border-black/15 bg-white/75 p-4 shadow-sm dark:border-white/15 dark:bg-[#121B31] sm:p-5"
                                >
                                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span
                                                    className={`inline-flex border px-2 py-1 text-xs font-bold ${statusClassNames[status.tone]}`}
                                                >
                                                    {status.label}
                                                </span>
                                                <span className="text-xs text-black/50 dark:text-white/50">
                                                    Uploaded {formatUploadedAt(paper.createdAt)}
                                                </span>
                                            </div>
                                            <h2 className="mt-3 break-words text-lg font-bold">
                                                {paper.title}
                                            </h2>
                                            <p className="mt-2 text-sm text-black/65 dark:text-white/65">
                                                {status.description}
                                            </p>
                                            <p className="mt-3 text-xs text-black/50 dark:text-white/50">
                                                {metadata.join(" · ")}
                                            </p>
                                            {paper.aiReview?.summary ? (
                                                <p className="mt-3 border-l-2 border-black/15 pl-3 text-xs leading-relaxed text-black/55 dark:border-white/15 dark:text-white/55">
                                                    {paper.aiReview.summary}
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="flex shrink-0 flex-wrap gap-2 text-xs font-semibold">
                                            <a
                                                href={fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="border border-black/25 px-3 py-2 hover:border-black dark:border-white/25 dark:hover:border-white"
                                            >
                                                Open file
                                            </a>
                                            {paper.isClear ? (
                                                <Link
                                                    href={getPastPaperDetailPath(
                                                        paper.id,
                                                        paper.courseCode,
                                                    )}
                                                    className="border border-black bg-black px-3 py-2 text-white dark:border-white dark:bg-white dark:text-black"
                                                >
                                                    View published paper
                                                </Link>
                                            ) : null}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                )}
            </div>
        </main>
    );
}
