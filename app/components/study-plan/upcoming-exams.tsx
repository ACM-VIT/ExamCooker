"use client";

import { ArrowRight } from "lucide-react";

type CourseCard = {
  id: string;
  code: string;
  title: string;
  paperCount: number;
};

type Props = {
  courses: CourseCard[];
  onPick: (code: string) => void;
  title?: string;
  hint?: string;
};

// Same card grammar as the rest of the site (course-grid-card.tsx): filled cyan
// in light, dark surface in dark, gray mono code, big paper count. These double
// as one-tap entry points into the planner.
export default function CoursePickGrid({
  courses,
  onPick,
  title = "Upcoming exams",
  hint = "Pick one to start",
}: Props) {
  if (courses.length === 0) return null;

  return (
    <section className="sp-rise flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3 border-b border-black/10 pb-3 dark:border-[#D5D5D5]/10">
        <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl">
          {title}
        </h2>
        <span className="text-sm text-black/50 dark:text-[#D5D5D5]/50">
          {hint}
        </span>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {courses.map((course, index) => (
          <button
            key={course.id}
            type="button"
            style={{ ["--sp-i" as string]: 2 + Math.min(index, 7) }}
            onClick={() => onPick(course.code)}
            className="sp-rise ec-card-lift ec-press group relative flex h-full flex-col gap-3 overflow-hidden border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 text-left text-black transition-colors dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222]"
          >
            <span className="font-mono text-xs font-bold uppercase tracking-wide text-black/75 dark:text-[#D5D5D5]/70">
              {course.code}
            </span>
            <h3 className="line-clamp-3 text-base font-bold leading-snug">
              {course.title}
            </h3>
            <div className="mt-auto flex items-end justify-between gap-2 pt-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold leading-none tabular-nums">
                  {course.paperCount}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
                  paper{course.paperCount === 1 ? "" : "s"}
                </span>
              </div>
              <ArrowRight
                className="size-4 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-70"
                strokeWidth={2.5}
                aria-hidden
              />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
