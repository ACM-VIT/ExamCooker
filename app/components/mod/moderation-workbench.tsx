"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "@/app/components/common/app-image";
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  Check,
  ChartLine,
  ExternalLink,
  Flag,
  Pencil,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { Note, PastPaper } from "@/db";
import type {
  AiModerationReview,
  ModerationResourceType,
  ModerationSuggestion,
} from "@/lib/ai/moderation-review-types";
import {
  applyAiModerationSuggestion,
  approveItem,
  deleteItem,
  fetchModerationWorkbenchSnapshot,
  renameItem,
  runAiModerationReview,
} from "@/app/actions/moderator-actions";
import { useToast } from "@/app/components/ui/use-toast";
import { Shimmer } from "@/app/components/ui/shimmer";
import {
  recheckContentCorrectionReport,
  resolveContentCorrectionReport,
  type CorrectionReportResolution,
  type ModerationCorrectionReport,
} from "@/app/actions/content-correction-reports";
import { getPastPaperDetailPath } from "@/lib/seo";

type CourseSummary = { code: string; title: string } | null;
type QueueNote = Note & { course: CourseSummary };
type QueuePaper = PastPaper & { course: CourseSummary };
type QueueItem =
  | (QueueNote & { resourceType: "note" })
  | (QueuePaper & { resourceType: "pastPaper" });

type Props = {
  initialNotes: QueueNote[];
  initialPastPapers: QueuePaper[];
  initialCorrectionReports: ModerationCorrectionReport[];
  totalUsers: number;
};

type QueueFilter = "all" | "unreviewed" | "changes" | "duplicates";

const statusCopy = {
  approved: "Approved by AI",
  needs_changes: "Changes suggested",
  duplicate: "Possible duplicate",
  failed: "Review failed",
} as const;

const statusDot = {
  none: "bg-black/30 dark:bg-white/30",
  approved: "bg-emerald-600 dark:bg-emerald-300",
  needs_changes: "bg-amber-500 dark:bg-amber-300",
  duplicate: "bg-red-600 dark:bg-red-300",
  failed: "bg-black/40 dark:bg-white/40",
} as const;

const quietButton =
  "ec-press inline-flex h-9 items-center gap-2 border border-black/30 px-3 text-sm font-normal transition hover:border-black disabled:cursor-wait disabled:opacity-60 dark:border-white/30 dark:hover:border-white";

// The site's primary button, as used by the upload buttons: a backing layer
// behind a bordered button that slides up-left on hover to reveal it.
function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-flex h-9 w-fit items-stretch">
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[#0A0F1C] group-has-[:disabled]:hidden dark:bg-[#3BF4C7]"
      />
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="relative inline-flex h-full items-center gap-2 border-2 border-black bg-[#3BF4C7] px-3 text-sm font-bold text-black transition duration-150 enabled:group-hover:-translate-x-1 enabled:group-hover:-translate-y-1 disabled:cursor-wait disabled:opacity-60 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:enabled:group-hover:border-[#3BF4C7] dark:enabled:group-hover:text-[#3BF4C7]"
      >
        {children}
      </button>
    </span>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function metadataHref(item: QueueItem) {
  return item.resourceType === "note"
    ? "/mod/notes/review"
    : "/mod/papers/review";
}

function displayTitle(item: QueueItem) {
  return item.title.replace(/\.pdf$/i, "");
}

function currentMetadata(item: QueueItem) {
  if (item.resourceType === "note") {
    return [item.course?.code].filter(Boolean).join(" · ");
  }
  return [
    item.course?.code,
    item.examType?.replaceAll("_", "-"),
    item.slot ? `Slot ${item.slot}` : null,
    item.year,
  ]
    .filter(Boolean)
    .join(" · ");
}

function suggestionRows(item: QueueItem, suggestion: ModerationSuggestion) {
  const rows = [
    {
      label: "Title",
      current: displayTitle(item),
      next: suggestion.title,
      applicable: suggestion.title.trim().length >= 2,
    },
    {
      label: "Course",
      current: item.course?.code ?? "Not set",
      next: suggestion.courseCode ?? "Could not resolve",
      applicable: suggestion.courseId !== null,
    },
  ];
  if (item.resourceType === "pastPaper") {
    rows.push(
      {
        label: "Exam",
        current: item.examType?.replaceAll("_", "-") ?? "Not set",
        next: suggestion.examType?.replaceAll("_", "-") ?? "Not found",
        applicable: suggestion.examType !== null,
      },
      {
        label: "Year",
        current: item.year?.toString() ?? "Not set",
        next: suggestion.year?.toString() ?? "Not found",
        applicable: suggestion.year !== null,
      },
      {
        label: "Slot",
        current: item.slot ?? "Not set",
        next: suggestion.slot ?? "Not found",
        applicable: suggestion.slot !== null,
      },
      {
        label: "Semester",
        current: item.semester,
        next: suggestion.semester ?? item.semester,
        applicable: suggestion.semester !== null,
      },
      {
        label: "Campus",
        current: item.campus,
        next: suggestion.campus ?? item.campus,
        applicable: suggestion.campus !== null,
      },
      {
        label: "Paper kind",
        current: item.hasAnswerKey ? "Answer key" : "Question paper",
        next:
          suggestion.hasAnswerKey === null
            ? item.hasAnswerKey
              ? "Answer key"
              : "Question paper"
            : suggestion.hasAnswerKey
              ? "Answer key"
              : "Question paper",
        applicable: suggestion.hasAnswerKey !== null,
      },
    );
  }
  return rows.filter((row) => row.applicable && row.current !== row.next);
}

function hasSafelyApplicableSuggestion(
  item: QueueItem,
  suggestion: ModerationSuggestion,
) {
  const changes = suggestionRows(item, suggestion);
  if (item.resourceType === "note") return changes.length > 0;

  return changes.some((change) => {
    if (change.label === "Paper kind" && suggestion.hasAnswerKey === true) {
      return false;
    }
    if (
      change.label === "Course" &&
      item.hasAnswerKey &&
      suggestion.hasAnswerKey !== false
    ) {
      return false;
    }
    return true;
  });
}

function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return (
    <header className="flex items-end justify-between gap-4">
      <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
        {title}
      </h2>
      {detail ? (
        <span className="hidden text-sm text-black/55 dark:text-[#D5D5D5]/55 sm:block">
          {detail}
        </span>
      ) : null}
    </header>
  );
}

const correctionCategoryCopy: Record<string, string> = {
  wrong_title: "Wrong title",
  wrong_course: "Wrong course",
  wrong_exam_details: "Wrong exam details",
  wrong_resource_type: "Wrong resource type",
  duplicate: "Possible duplicate",
  other: "Other issue",
};

function CorrectionReportsPanel({
  reports,
  busyId,
  onRecheck,
  onResolve,
}: {
  reports: ModerationCorrectionReport[];
  busyId: string | null;
  onRecheck: (id: string) => void;
  onResolve: (id: string, resolution: CorrectionReportResolution) => void;
}) {
  if (reports.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading
        title="Reported corrections"
        detail={`${reports.length} awaiting a decision`}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {reports.map((report) => {
          const href =
            report.resourceType === "note"
              ? `/notes/${report.resourceId}`
              : getPastPaperDetailPath(
                  report.resourceId,
                  report.resourceCourseCode,
                );
          const checking = report.status === "pending" && !report.canRecheck;
          return (
            <article key={report.id} className="border-2 border-black/20 p-4 dark:border-white/20">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-amber-700/30 text-amber-800 dark:border-amber-300/30 dark:text-amber-300">
                  <Flag className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <strong className="text-sm">
                      {correctionCategoryCopy[report.category] ?? "Reported issue"}
                    </strong>
                    {checking ? (
                      <Shimmer className="text-xs font-semibold">Agent checking…</Shimmer>
                    ) : (
                      <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Needs moderator</span>
                    )}
                  </div>
                  <Link href={href} target="_blank" className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate text-sm font-semibold underline decoration-2 underline-offset-4">
                    {report.resourceTitle.replace(/\.pdf$/i, "")}
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                  </Link>
                  <p className="mt-2 text-sm leading-6 text-black/70 dark:text-[#D5D5D5]/70">{report.description}</p>
                  {report.suggestedValue ? (
                    <p className="mt-1 text-sm"><span className="text-black/50 dark:text-[#D5D5D5]/50">Suggested:</span> {report.suggestedValue}</p>
                  ) : null}
                  {report.aiDecision ? (
                    <p className="mt-2 border-l-2 border-amber-500/60 pl-3 text-xs leading-5 text-black/60 dark:text-[#D5D5D5]/60">
                      {report.aiDecision.summary} · {Math.round(report.aiDecision.confidence * 100)}% confidence
                    </p>
                  ) : null}
                  {report.isStale ? (
                    <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                      The resource changed after this review. Recheck before applying anything.
                    </p>
                  ) : null}
                  {!checking ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {report.canApply ? (
                        <button
                          type="button"
                          disabled={busyId === report.id}
                          onClick={() => onResolve(report.id, "apply")}
                          className={quietButton}
                        >
                          <Check className="size-4" aria-hidden />
                          Apply & resolve
                        </button>
                      ) : null}
                      {report.canConvertType ? (
                        <button
                          type="button"
                          disabled={busyId === report.id}
                          onClick={() => onResolve(report.id, "convert_type")}
                          className={quietButton}
                        >
                          Move to {report.resourceType === "note" ? "past papers" : "notes"}
                        </button>
                      ) : null}
                      {report.canUnpublishDuplicate ? (
                        <button
                          type="button"
                          disabled={busyId === report.id}
                          onClick={() => onResolve(report.id, "unpublish_duplicate")}
                          className={quietButton}
                        >
                          Unpublish duplicate
                        </button>
                      ) : null}
                      {report.canRecheck ? (
                        <button
                          type="button"
                          disabled={busyId === report.id}
                          onClick={() => onRecheck(report.id)}
                          className={quietButton}
                        >
                          <Bot className="size-4" aria-hidden />
                          Recheck
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId === report.id}
                        onClick={() => onResolve(report.id, "dismiss")}
                        className={quietButton}
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function buildQueueItems(initialNotes: QueueNote[], initialPastPapers: QueuePaper[]) {
  return [
    ...initialNotes.map((item) => ({ ...item, resourceType: "note" as const })),
    ...initialPastPapers.map((item) => ({
      ...item,
      resourceType: "pastPaper" as const,
    })),
  ].sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt));
}

function StatCard({
  label,
  value,
  detail,
  active,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="block text-sm font-normal text-black/65 dark:text-[#D5D5D5]/65">
        {label}
      </span>
      <span className="mt-auto block pt-5">
        <strong className="block text-3xl font-black leading-none tabular-nums sm:text-4xl">
          {value.toLocaleString("en-IN")}
        </strong>
        <span className="mt-2 block text-xs leading-5 text-black/60 dark:text-[#D5D5D5]/55">
          {detail}
        </span>
      </span>
    </>
  );
  const surface = active
    ? "border-black bg-[#5FC4E7] dark:border-[#3BF4C7] dark:bg-white/10"
    : "border-[#5FC4E7] bg-[#5FC4E7] dark:border-white/20 dark:bg-white/10 dark:lg:bg-[#0C1222]";
  if (!onClick) {
    return (
      <article className={`flex min-h-32 flex-col border-2 p-4 text-left text-black dark:text-[#D5D5D5] ${surface}`}>
        {body}
      </article>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`ec-press flex min-h-32 flex-col border-2 p-4 text-left text-black transition dark:text-[#D5D5D5] ${surface} ${
        active ? "" : "hover:border-black dark:hover:border-white/60"
      }`}
    >
      {body}
    </button>
  );
}

function QueueListRow({
  item,
  active,
  busy,
  onSelect,
}: {
  item: QueueItem;
  active: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  const status = item.aiReview?.status ?? "none";
  return (
    <li className="border-t border-black/10 first:border-t-0 dark:border-white/10">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={`flex w-full gap-3 px-3 py-3 text-left transition-colors ${
          active
            ? "bg-[#5FC4E7]/35 dark:bg-white/[0.07]"
            : "hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
        }`}
      >
        <span className="relative h-13 w-10 shrink-0 overflow-hidden border border-black/20 bg-black/5 dark:border-white/15 dark:bg-white/5">
          <Image
            src={item.thumbNailUrl || "/assets/exam-cooker.png"}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm leading-snug ${active ? "font-bold" : "font-semibold"}`}>
            {displayTitle(item)}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-black/50 dark:text-[#D5D5D5]/50">
            {item.resourceType === "note" ? "Notes" : "Past paper"}
            {currentMetadata(item) ? ` · ${currentMetadata(item)}` : ""} · {formatDate(item.createdAt)}
          </span>
          {busy ? (
            <Shimmer className="mt-1 block text-[11px] font-semibold" duration={1.6}>
              Agent working…
            </Shimmer>
          ) : (
            <span className="mt-1 flex items-center gap-1.5 text-[11px] text-black/55 dark:text-[#D5D5D5]/55">
              <span aria-hidden="true" className={`size-1.5 shrink-0 ${statusDot[status]}`} />
              {item.aiReview ? statusCopy[item.aiReview.status] : "Awaiting AI review"}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function ReviewBadge({ review }: { review: AiModerationReview | null }) {
  if (!review) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-black/55 dark:text-[#D5D5D5]/55">
        <span aria-hidden="true" className={`size-1.5 ${statusDot.none}`} />
        Awaiting AI review
      </span>
    );
  }
  const tone = {
    approved: "text-emerald-800 dark:text-emerald-300",
    needs_changes: "text-amber-800 dark:text-amber-300",
    duplicate: "text-red-700 dark:text-red-300",
    failed: "text-black/70 dark:text-[#D5D5D5]/70",
  }[review.status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tone}`}>
      {review.status === "duplicate" || review.status === "failed" ? (
        <TriangleAlert className="size-3.5" aria-hidden />
      ) : (
        <Bot className="size-3.5" aria-hidden />
      )}
      {statusCopy[review.status]}
    </span>
  );
}

function DetailPanel({
  item,
  busyLabel,
  onReview,
  onApply,
  onApprove,
  onApproveAnyway,
  onDelete,
  onRename,
}: {
  item: QueueItem;
  busyLabel: string | null;
  onReview: () => void;
  onApply: () => void;
  onApprove: () => void;
  onApproveAnyway: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const busy = busyLabel !== null;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(displayTitle(item));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const review = item.aiReview;
  const changes = review ? suggestionRows(item, review.suggestion) : [];
  const canApplySuggestion = review
    ? hasSafelyApplicableSuggestion(item, review.suggestion)
    : false;
  const metadata = currentMetadata(item);

  return (
    <article className="border-2 border-black/20 p-4 dark:border-white/20 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
        <a
          href={item.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="group relative h-40 w-28 shrink-0 overflow-hidden border border-black/25 bg-black/5 dark:border-white/20 dark:bg-white/5"
        >
          <Image
            src={item.thumbNailUrl || "/assets/exam-cooker.png"}
            alt={`Preview of ${item.title}`}
            fill
            sizes="112px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/70 py-1 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
            Open PDF <ExternalLink className="size-2.5" aria-hidden />
          </span>
        </a>

        <div className="min-w-0 flex-1">
          <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs font-normal text-black/50 dark:text-[#D5D5D5]/50">
              {item.resourceType === "note" ? "Notes" : "Past paper"} · uploaded {formatDate(item.createdAt)}
            </span>
            {busy ? (
              <Shimmer className="text-xs font-semibold" duration={1.6}>
                {busyLabel}
              </Shimmer>
            ) : (
              <ReviewBadge review={item.aiReview} />
            )}
          </div>

          {editing ? (
            <div className="mt-2 flex max-w-xl flex-wrap gap-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-label="Resource title"
                className="ec-focus-ring h-9 min-w-0 flex-1 border border-black/30 bg-white/70 px-3 text-sm outline-none dark:border-white/30 dark:bg-white/5"
              />
              <PrimaryButton
                disabled={busy || !title.trim()}
                onClick={() => {
                  onRename(title.trim());
                  setEditing(false);
                }}
              >
                Save
              </PrimaryButton>
              <button
                type="button"
                onClick={() => {
                  setTitle(displayTitle(item));
                  setEditing(false);
                }}
                className={quietButton}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-start gap-2">
              <a
                href={item.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="break-words text-xl font-bold leading-snug decoration-2 underline-offset-4 hover:underline sm:text-2xl"
              >
                {displayTitle(item)}
              </a>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="ec-icon-button mt-1.5 text-black/45 hover:text-black dark:text-[#D5D5D5]/45 dark:hover:text-[#D5D5D5]"
                aria-label="Edit title"
              >
                <Pencil className="size-3.5" aria-hidden />
              </button>
            </div>
          )}

          <p className="mt-1 text-sm text-black/60 dark:text-[#D5D5D5]/60 sm:text-sm">
            {metadata || "Metadata incomplete"}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-black/35 dark:text-[#D5D5D5]/35 sm:text-[10px]">
            {item.id}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <PrimaryButton onClick={onReview} disabled={busy}>
              <Bot className="size-4" aria-hidden />
              {item.aiReview ? "Review again" : "Run AI review"}
            </PrimaryButton>
            {item.aiReview?.status === "needs_changes" && canApplySuggestion && (
              <button type="button" onClick={onApply} disabled={busy} className={quietButton}>
                Apply changes & recheck
              </button>
            )}
            {item.aiReview?.status === "duplicate" ? (
              <button
                type="button"
                onClick={onApproveAnyway}
                disabled={busy}
                className="ec-press inline-flex h-9 items-center gap-2 border border-red-700/50 px-3 text-sm font-normal text-red-800 transition hover:border-red-700 disabled:opacity-60 dark:border-red-300/40 dark:text-red-300 dark:hover:border-red-300"
              >
                Approve anyway
              </button>
            ) : (
              <button type="button" onClick={onApprove} disabled={busy} className={quietButton}>
                <Check className="size-4" aria-hidden /> Manual approve
              </button>
            )}
            <Link
              href={metadataHref(item)}
              className="ec-press inline-flex h-9 items-center px-1 text-sm font-semibold underline decoration-2 underline-offset-4"
            >
              Edit all metadata
            </Link>
            {confirmingDelete ? (
              <span className="inline-flex h-9 items-center gap-1.5 border border-red-700/50 px-2 text-sm dark:border-red-300/40">
                Delete?
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDelete}
                  className="px-1 font-bold text-red-700 dark:text-red-300"
                >
                  Yes
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} className="px-1 font-semibold">
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="ec-icon-button ml-auto p-2 text-black/40 hover:text-red-700 dark:text-[#D5D5D5]/40 dark:hover:text-red-300"
                aria-label="Delete resource"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>

      {review ? (
        <>
          <div className="mt-5 border-t border-black/15 pt-4 dark:border-white/15">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-base font-bold sm:text-base">AI assessment</h3>
              <span className="font-mono text-[10px] text-black/45 dark:text-[#D5D5D5]/45">
                {Math.round(review.confidence * 100)}% confidence · {review.corpusSize} in corpus
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-black/70 dark:text-[#D5D5D5]/70 sm:text-sm">
              {review.summary}
            </p>
            {review.issues.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {review.issues.map((issue, index) => (
                  <li
                    key={`${issue.field}-${index}`}
                    className="flex gap-2 text-sm leading-6 text-black/75 dark:text-[#D5D5D5]/75"
                  >
                    <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 bg-amber-500 dark:bg-amber-300" />
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
            {review.duplicate && (
              <Link
                href={
                  item.resourceType === "note"
                    ? `/notes/${review.duplicate.id}`
                    : getPastPaperDetailPath(
                        review.duplicate.id,
                        review.suggestion.courseCode ?? item.course?.code,
                      )
                }
                target="_blank"
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold underline decoration-2 underline-offset-4"
              >
                Open {review.duplicate.title}
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>
          <div className="mt-4 border-t border-black/15 pt-4 dark:border-white/15">
            <h3 className="text-base font-bold sm:text-base">Suggested changes</h3>
            {changes.length > 0 ? (
              <dl className="mt-2 max-w-3xl space-y-2">
                {changes.map((row) => (
                  <div key={row.label} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-sm leading-6">
                    <dt className="text-black/50 dark:text-[#D5D5D5]/50">{row.label}</dt>
                    <dd className="min-w-0 break-words">
                      <span className="text-black/45 line-through dark:text-[#D5D5D5]/45">{row.current}</span>
                      <span className="mx-1.5 text-black/35 dark:text-[#D5D5D5]/35">→</span>
                      <span className="font-semibold">{row.next}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-black/55 dark:text-[#D5D5D5]/55 sm:text-sm">
                The submitted metadata matches the PDF.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="mt-5 border-t border-black/15 pt-4 text-sm text-black/60 dark:border-white/15 dark:text-[#D5D5D5]/60 sm:text-sm">
          Run the review to classify the PDF, validate its metadata, and compare it with the destination course corpus.
        </p>
      )}
    </article>
  );
}

export function ModerationWorkbenchSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the moderation queue"
      className="min-h-dvh bg-[#C2E6EC] text-black transition-colors dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <header className="border-b-2 border-black/20 pb-5 dark:border-white/20">
          <div className="flex items-center justify-between gap-3">
            <div className="h-5 w-28 animate-pulse bg-black/10 dark:bg-white/10" />
            <div className="flex gap-2">
              <div className="h-9 w-36 animate-pulse bg-black/10 dark:bg-white/10" />
              <div className="h-9 w-32 animate-pulse bg-black/10 dark:bg-white/10" />
            </div>
          </div>
          <div className="mt-5">
            <div className="h-3 w-52 animate-pulse bg-black/10 dark:bg-white/10" />
            <div className="mt-2 h-9 w-72 animate-pulse bg-black/15 dark:bg-white/15" />
          </div>
        </header>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className={`min-h-32 animate-pulse border-2 border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5 ${index === 4 ? "hidden lg:block" : ""}`}
            />
          ))}
        </section>
        <section className="grid items-start gap-3 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
          <div className="border-2 border-black/20 dark:border-white/20">
            <div className="space-y-2 border-b border-black/10 p-3 dark:border-white/10">
              <div className="h-9 w-full animate-pulse bg-black/10 dark:bg-white/10" />
              <div className="flex gap-2">
                <div className="h-8 w-16 animate-pulse bg-black/10 dark:bg-white/10" />
                <div className="h-8 w-20 animate-pulse bg-black/10 dark:bg-white/10" />
                <div className="h-8 w-24 animate-pulse bg-black/10 dark:bg-white/10" />
              </div>
            </div>
            <ul>
              {Array.from({ length: 5 }, (_, index) => (
                <li key={index} className="flex gap-3 border-t border-black/10 p-3 first:border-t-0 dark:border-white/10">
                  <div className="h-13 w-10 shrink-0 animate-pulse bg-black/10 dark:bg-white/10" />
                  <div className="min-w-0 flex-1 space-y-2 py-0.5">
                    <div className="h-3.5 w-3/4 animate-pulse bg-black/15 dark:bg-white/15" />
                    <div className="h-3 w-1/2 animate-pulse bg-black/10 dark:bg-white/10" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-2 border-black/20 p-5 dark:border-white/20">
            <div className="flex gap-5">
              <div className="h-40 w-28 shrink-0 animate-pulse bg-black/10 dark:bg-white/10" />
              <div className="min-w-0 flex-1 space-y-3 py-1">
                <div className="h-3 w-48 animate-pulse bg-black/10 dark:bg-white/10" />
                <div className="h-7 w-2/3 animate-pulse bg-black/15 dark:bg-white/15" />
                <div className="h-3 w-1/2 animate-pulse bg-black/10 dark:bg-white/10" />
                <div className="mt-4 flex gap-2">
                  <div className="h-9 w-36 animate-pulse bg-black/15 dark:bg-white/15" />
                  <div className="h-9 w-40 animate-pulse bg-black/10 dark:bg-white/10" />
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-2 border-t border-black/10 pt-4 dark:border-white/10">
              <div className="h-4 w-32 animate-pulse bg-black/10 dark:bg-white/10" />
              <div className="h-3 w-full animate-pulse bg-black/10 dark:bg-white/10" />
              <div className="h-3 w-2/3 animate-pulse bg-black/10 dark:bg-white/10" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ModerationWorkbench({ initialNotes, initialPastPapers, initialCorrectionReports, totalUsers }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<QueueItem[]>(() =>
    buildQueueItems(initialNotes, initialPastPapers),
  );
  const [kind, setKind] = useState<"all" | ModerationResourceType>("all");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<{ id: string; label: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctionReports, setCorrectionReports] = useState(initialCorrectionReports);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (busy || busyReportId) return;

    let cancelled = false;
    let polling = false;
    const refreshQueue = async () => {
      if (polling || document.visibilityState === "hidden") return;
      polling = true;
      try {
        const snapshot = await fetchModerationWorkbenchSnapshot();
        if (cancelled) return;
        setItems(buildQueueItems(snapshot.notes, snapshot.pastPapers));
        setCorrectionReports(snapshot.correctionReports);
      } catch {
        // Keep the last usable queue; the next poll will retry.
      } finally {
        polling = false;
      }
    };

    const timer = window.setInterval(() => void refreshQueue(), 4_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [busy, busyReportId]);

  const counts = useMemo(() => ({
    all: items.length,
    unreviewed: items.filter((item) => !item.aiReview || item.aiReview.status === "failed").length,
    changes: items.filter((item) => item.aiReview?.status === "needs_changes").length,
    duplicates: items.filter((item) => item.aiReview?.status === "duplicate").length,
  }), [items]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (kind !== "all" && item.resourceType !== kind) return false;
      if (filter === "unreviewed" && item.aiReview && item.aiReview.status !== "failed") return false;
      if (filter === "changes" && item.aiReview?.status !== "needs_changes") return false;
      if (filter === "duplicates" && item.aiReview?.status !== "duplicate") return false;
      if (!normalizedQuery) return true;
      return [item.title, item.course?.code, item.course?.title, item.id]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery));
    });
  }, [filter, items, kind, query]);

  const selected = visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0] ?? null;

  const selectItem = (id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  };

  const remove = (id: string) => setItems((current) => current.filter((item) => item.id !== id));

  const replaceReview = (id: string, review: AiModerationReview) => {
    if (review.autoApproved) {
      remove(id);
      toast({ title: "Reviewed and approved." });
      return;
    }
    setItems((current) => current.map((item) => item.id === id ? { ...item, aiReview: review } : item));
  };

  const replaceAppliedReview = (
    id: string,
    result: Awaited<ReturnType<typeof applyAiModerationSuggestion>>,
  ) => {
    if (result.review.autoApproved) {
      remove(id);
      toast({ title: "Changes applied and upload approved." });
      return;
    }

    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const course =
          result.applied.courseCode && result.applied.courseTitle
            ? {
                code: result.applied.courseCode,
                title: result.applied.courseTitle,
              }
            : null;

        if (item.resourceType === "note") {
          return {
            ...item,
            title: result.applied.title,
            courseId: result.applied.courseId,
            course,
            aiReview: result.review,
          };
        }

        return {
          ...item,
          title: result.applied.title,
          courseId: result.applied.courseId,
          course,
          examType: result.applied.examType,
          slot: result.applied.slot,
          year: result.applied.year,
          semester: result.applied.semester ?? item.semester,
          campus: result.applied.campus ?? item.campus,
          hasAnswerKey: result.applied.hasAnswerKey ?? item.hasAnswerKey,
          aiReview: result.review,
        };
      }),
    );
    toast({ title: "Changes applied. The remaining issues still need review." });
  };

  const perform = async (id: string, label: string, task: () => Promise<void>) => {
    setBusy({ id, label });
    try {
      await task();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "The moderation action failed.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const resolveReport = async (
    id: string,
    resolution: CorrectionReportResolution,
  ) => {
    setBusyReportId(id);
    try {
      const result = await resolveContentCorrectionReport(id, resolution);
      setCorrectionReports((current) => current.filter((report) => report.id !== id));
      toast({
        title:
          resolution === "dismiss"
            ? "Report dismissed."
            : resolution === "convert_type"
              ? "Resource moved to the correct section."
              : resolution === "unpublish_duplicate"
                ? "Duplicate unpublished."
            : result.appliedFields.length > 0
              ? "Correction applied and report resolved."
              : "Correction resolved.",
      });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "The report could not be updated.",
        variant: "destructive",
      });
    } finally {
      setBusyReportId(null);
    }
  };

  const recheckReport = async (id: string) => {
    setBusyReportId(id);
    try {
      await recheckContentCorrectionReport(id);
      setCorrectionReports((current) =>
        current.map((report) =>
          report.id === id
            ? {
                ...report,
                status: "pending",
                aiDecision: null,
                canApply: false,
                canConvertType: false,
                canRecheck: false,
                canUnpublishDuplicate: false,
                isStale: false,
              }
            : report,
        ),
      );
      toast({ title: "Agent recheck started." });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "The recheck could not be started.",
        variant: "destructive",
      });
    } finally {
      setBusyReportId(null);
    }
  };

  return (
    <div className="min-h-dvh bg-[#C2E6EC] text-black transition-colors dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <header className="border-b-2 border-black/20 pb-5 dark:border-white/20">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="hidden h-9 items-center gap-2 text-sm font-semibold text-black/65 transition hover:text-black dark:text-[#D5D5D5]/65 dark:hover:text-[#D5D5D5] lg:inline-flex"
            >
              <ArrowLeft className="size-4" aria-hidden />
              ExamCooker
            </Link>
            <span className="lg:hidden" aria-hidden="true" />
            <nav aria-label="Moderator tools" className="flex items-center gap-2">
              <Link href="/mod/upcoming" className={quietButton}>
                <CalendarDays className="size-4" aria-hidden />
                <span className="hidden sm:inline">Upcoming exams</span>
              </Link>
              <Link href="/mod/observability" className={quietButton}>
                <ChartLine className="size-4" aria-hidden />
                <span className="hidden sm:inline">Azure metrics</span>
              </Link>
            </nav>
          </div>

          <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
              Moderation queue
            </h1>
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`size-2 shrink-0 ${items.length + correctionReports.length === 0 ? "bg-emerald-600 dark:bg-emerald-300" : "bg-amber-500 dark:bg-amber-300"}`}
                aria-hidden="true"
              />
              <strong>{items.length + correctionReports.length === 0 ? "All clear" : `${items.length + correctionReports.length} pending`}</strong>
            </div>
          </div>
        </header>

        <section className="flex flex-col gap-4" aria-label="Queue overview and status filter">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              label="In the queue"
              value={counts.all}
              detail="Every pending upload"
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            <StatCard
              label="Needs AI"
              value={counts.unreviewed}
              detail="Awaiting a first review"
              active={filter === "unreviewed"}
              onClick={() => setFilter("unreviewed")}
            />
            <StatCard
              label="Suggestions"
              value={counts.changes}
              detail="Metadata fixes proposed"
              active={filter === "changes"}
              onClick={() => setFilter("changes")}
            />
            <StatCard
              label="Duplicates"
              value={counts.duplicates}
              detail="Need a human call"
              active={filter === "duplicates"}
              onClick={() => setFilter("duplicates")}
            />
            <div className="col-span-2 lg:col-span-1">
              <StatCard label="Users" value={totalUsers} detail="Registered accounts" />
            </div>
          </div>
        </section>

        <CorrectionReportsPanel
          reports={correctionReports}
          busyId={busyReportId}
          onRecheck={recheckReport}
          onResolve={resolveReport}
        />

        <section className="flex flex-col gap-4">
          <SectionHeading
            title="Review queue"
            detail={`${visibleItems.length} of ${items.length} shown`}
          />
          <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
            <div className="flex flex-col border-2 border-black/20 dark:border-white/20 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)]">
              <div className="shrink-0 space-y-2 border-b border-black/10 p-3 dark:border-white/10">
                <div className="ec-focus-ring flex h-10 items-center border border-black/30 bg-white/60 px-3 dark:border-white/30 dark:bg-white/5">
                  <Search className="size-4 shrink-0 text-black/45 dark:text-[#D5D5D5]/45" aria-hidden />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, course, or ID"
                    className="min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-black/40 dark:placeholder:text-[#D5D5D5]/40"
                  />
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Resource type">
                  {(["all", "note", "pastPaper"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={kind === value}
                      onClick={() => setKind(value)}
                      className={`h-9 border px-3 text-xs font-normal transition ${
                        kind === value
                          ? "border-black bg-black text-[#C2E6EC] dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/10 dark:text-[#3BF4C7]"
                          : "border-black/25 hover:border-black dark:border-white/25 dark:hover:border-white"
                      }`}
                    >
                      {value === "all" ? "All" : value === "note" ? "Notes" : "Past papers"}
                    </button>
                  ))}
                </div>
              </div>
              {visibleItems.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-black/55 dark:text-[#D5D5D5]/55 sm:text-sm">
                  Nothing matches this filter.
                </p>
              ) : (
                <ul className="min-h-0 flex-1 lg:overflow-y-auto">
                  {visibleItems.map((item) => (
                    <QueueListRow
                      key={item.id}
                      item={item}
                      active={selected?.id === item.id}
                      busy={busy?.id === item.id}
                      onSelect={() => selectItem(item.id)}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div ref={detailRef} className="scroll-mt-4">
              {selected ? (
                <DetailPanel
                  key={selected.id}
                  item={selected}
                  busyLabel={busy?.id === selected.id ? busy.label : null}
                  onReview={() =>
                    perform(selected.id, "AI is reading the PDF and checking the course corpus…", async () =>
                      replaceReview(selected.id, await runAiModerationReview(selected.id, selected.resourceType)),
                    )
                  }
                  onApply={() =>
                    perform(selected.id, "Applying the suggested changes and rechecking…", async () =>
                      replaceAppliedReview(
                        selected.id,
                        await applyAiModerationSuggestion(selected.id, selected.resourceType),
                      ),
                    )
                  }
                  onApprove={() =>
                    perform(selected.id, "Approving this upload…", async () => {
                      const result = await approveItem(selected.id, selected.resourceType);
                      if (result.status === "duplicate") throw new Error(`Duplicate found: ${result.duplicateTitle}`);
                      remove(selected.id);
                    })
                  }
                  onApproveAnyway={() =>
                    perform(selected.id, "Approving despite the duplicate…", async () => {
                      await approveItem(selected.id, selected.resourceType, { allowDuplicate: true });
                      remove(selected.id);
                    })
                  }
                  onDelete={() =>
                    perform(selected.id, "Deleting this upload…", async () => {
                      await deleteItem(selected.id, selected.resourceType);
                      remove(selected.id);
                    })
                  }
                  onRename={(nextTitle) =>
                    perform(selected.id, "Renaming and resetting the review…", async () => {
                      await renameItem(selected.id, selected.resourceType, nextTitle);
                      setItems((current) =>
                        current.map((currentItem) =>
                          currentItem.id === selected.id
                            ? { ...currentItem, title: nextTitle, aiReview: null }
                            : currentItem,
                        ),
                      );
                    })
                  }
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-black/25 px-6 py-16 text-center dark:border-white/20">
                  <Check className="size-6 text-black/60 dark:text-[#3BF4C7]" aria-hidden />
                  <div>
                    <h3 className="text-lg font-bold sm:text-lg">Nothing needs attention here</h3>
                    <p className="mt-1 text-sm text-black/55 dark:text-[#D5D5D5]/55 sm:text-sm">
                      Every upload has been reviewed.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
