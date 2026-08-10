"use client";

import { ChevronLeft } from "lucide-react";
import { useParams } from "next/navigation";

type DocumentViewerShellProps = {
  kind: "note" | "paper" | "syllabus";
};

function readRouteCode(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).toUpperCase();
  } catch {
    return raw.toUpperCase();
  }
}

export default function DocumentViewerShell({ kind }: DocumentViewerShellProps) {
  const params = useParams<{ code?: string | string[] }>();
  const courseCode = readRouteCode(params.code);
  const documentLabel =
    kind === "paper" ? "Past paper" : kind === "syllabus" ? "Syllabus" : "Notes";
  const heading = courseCode ? `${courseCode} ${documentLabel.toLowerCase()}` : documentLabel;

  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 pb-10 pt-4 sm:gap-5 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 xl:px-10"
      aria-hidden="true"
    >
      <div className="flex h-5 items-center gap-2 text-sm font-semibold text-black/60 dark:text-[#D5D5D5]/60">
        <ChevronLeft className="size-4" />
        <span>{courseCode ?? documentLabel}</span>
      </div>

      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-pretty text-2xl font-bold leading-[1.15] tracking-tight sm:text-3xl lg:text-4xl">
            {heading}
          </h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {kind === "paper" ? (
              <>
                <span className="inline-flex h-7 w-16 border border-black/12 bg-white dark:border-[#D5D5D5]/12 dark:bg-[#0C1222]" />
                <span className="inline-flex h-7 w-12 border border-black/12 bg-white dark:border-[#D5D5D5]/12 dark:bg-[#0C1222]" />
              </>
            ) : null}
            {courseCode ? (
              <span className="inline-flex h-7 items-center gap-1.5 border border-black/15 bg-white px-2.5 text-xs font-semibold text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]">
                <span className="text-[10px] uppercase tracking-wider text-black/45 dark:text-[#D5D5D5]/45">
                  Course
                </span>
                <span>{courseCode}</span>
              </span>
            ) : (
              <span className="inline-flex h-7 w-24 border border-black/15 bg-white dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]" />
            )}
            {kind === "syllabus" ? (
              <span className="inline-flex h-7 items-center gap-1.5 border border-black/15 bg-white px-2.5 text-xs font-semibold text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]">
                <span className="text-[10px] uppercase tracking-wider text-black/45 dark:text-[#D5D5D5]/45">
                  Type
                </span>
                <span>Syllabus</span>
              </span>
            ) : null}
          </div>
          {kind === "note" ? (
            <span className="mt-3 block h-3 w-44 bg-black/10 dark:bg-white/10" />
          ) : null}
        </div>
        {kind !== "syllabus" ? (
          <div className="h-9 w-28 shrink-0 border border-black/15 bg-white dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]" />
        ) : null}
      </header>

      <div className="overflow-hidden border border-black/15 bg-white shadow-[0_4px_28px_-14px_rgba(0,0,0,0.25)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:shadow-[0_4px_28px_-14px_rgba(0,0,0,0.6)]">
        <div className="h-[70dvh] sm:h-[78dvh] lg:h-[84dvh] xl:h-[86dvh]" />
      </div>
    </div>
  );
}
