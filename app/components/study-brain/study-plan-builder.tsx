"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CourseSearchRecord } from "@/lib/data/course-catalog";
import { examTypeValues } from "@/db/enums";
import { examTypeLabel } from "@/lib/exam-slug";
import { getCoursePastPapersPath } from "@/lib/seo";
import { GradientText } from "@/app/components/landing/landing";
import type { StudyPreferenceMode } from "@/lib/study-brain/schemas";

type Props = {
  courses: CourseSearchRecord[];
  initialCourse?: string;
  initialExam?: string;
  initialSlot?: string;
};

const preferenceOptions: Array<{
  id: StudyPreferenceMode;
  label: string;
}> = [
  { id: "past_papers", label: "Past papers" },
  { id: "videos", label: "Videos" },
  { id: "notes", label: "Notes" },
  { id: "solved_examples", label: "Solved examples" },
  { id: "quick_summaries", label: "Quick summaries" },
  { id: "mixed", label: "Mixed" },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const chipBase =
  "inline-flex h-9 shrink-0 items-center gap-1.5 border px-3 text-sm font-semibold transition";
const chipActive =
  "border-[#5FC4E7] bg-[#5FC4E7]/25 text-black dark:border-[#3BF4C7]/60 dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]";
const chipIdle =
  "border-black/15 bg-white text-black hover:border-black/30 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#D5D5D5]/40";

const sectionLabel =
  "text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl";

export default function StudyPlanBuilder({
  courses,
  initialCourse = "",
  initialExam = "",
  initialSlot = "",
}: Props) {
  const { prefetch } = useRouter();
  const [courseQuery, setCourseQuery] = useState(initialCourse);
  const [selectedCourseCode, setSelectedCourseCode] = useState(
    initialCourse.toUpperCase(),
  );
  const [examType, setExamType] = useState(initialExam.toUpperCase());
  const [slot, setSlot] = useState(initialSlot.toUpperCase());
  const [preferences, setPreferences] = useState<StudyPreferenceMode[]>([
    "past_papers",
    "mixed",
  ]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.code.toUpperCase() === selectedCourseCode),
    [courses, selectedCourseCode],
  );

  const matches = useMemo(() => {
    const query = normalize(courseQuery);
    if (!query) return courses.slice(0, 6);
    return courses
      .filter((course) => {
        const haystack = normalize(
          `${course.code} ${course.title} ${course.aliases.join(" ")}`,
        );
        return haystack.includes(query);
      })
      .slice(0, 6);
  }, [courseQuery, courses]);

  const togglePreference = (id: StudyPreferenceMode) => {
    setPreferences((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const readyToContinue = Boolean(selectedCourse && examType);

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <section className="flex flex-col gap-4">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-black/70 dark:text-[#D5D5D5]/70">
          Study plan
        </span>
        <h1 className="text-[1.5rem] font-black leading-none text-black dark:text-[#D5D5D5] min-[400px]:text-3xl sm:text-5xl lg:text-6xl">
          What do you wanna <GradientText>study?</GradientText>
        </h1>
        <p className="max-w-2xl text-xs leading-5 text-black/65 dark:text-[#D5D5D5]/65 sm:text-base sm:leading-6">
          Pick the course, exam, and slot. ExamCooker uses the syllabus, previous
          papers, and earlier-slot reports to line up a queue with time estimates —
          high-yield first, skip-if-cooked last.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className={sectionLabel}>Course</h2>
        <div className="ec-focus-ring flex h-12 items-center border border-black/15 bg-white px-1 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] sm:h-11">
          <input
            type="text"
            inputMode="search"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search for a course"
            value={courseQuery}
            onChange={(event) => {
              setCourseQuery(event.target.value);
              setSelectedCourseCode("");
            }}
            placeholder="Mechanics, BCME102L, DSA..."
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-black focus:outline-none placeholder:text-black/50 dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/60 sm:text-base"
          />
        </div>

        {matches.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {matches.map((course) => {
              const active = course.code.toUpperCase() === selectedCourseCode;
              return (
                <button
                  key={course.id}
                  type="button"
                  onPointerEnter={() => prefetch(getCoursePastPapersPath(course.code))}
                  onClick={() => {
                    setSelectedCourseCode(course.code.toUpperCase());
                    setCourseQuery(`${course.code} ${course.title}`);
                  }}
                  className={`ec-press flex h-full flex-col gap-2 border-2 p-4 text-left transition ${
                    active
                      ? "border-black bg-[#5FC4E7] text-black dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/20 dark:text-[#D5D5D5]"
                      : "border-[#5FC4E7] bg-[#5FC4E7] text-black hover:scale-[1.02] dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222] dark:hover:border-b-[#3BF4C7]"
                  }`}
                >
                  <span className="font-mono text-xs font-bold uppercase tracking-wide text-black/75 dark:text-[#D5D5D5]/70">
                    {course.code}
                  </span>
                  <span className="line-clamp-2 text-sm font-bold leading-snug text-black dark:text-[#D5D5D5]">
                    {course.title}
                  </span>
                  <span className="mt-auto pt-1 text-[10px] font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
                    {course.paperCount} paper{course.paperCount === 1 ? "" : "s"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-8 sm:gap-10 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <h2 className={sectionLabel}>Exam &amp; slot</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {examTypeValues.map((value) => {
              const active = examType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setExamType(active ? "" : value)}
                  className={`${chipBase} ${active ? chipActive : chipIdle}`}
                >
                  {examTypeLabel(value)}
                </button>
              );
            })}
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
              Slot
            </span>
            <div className="ec-focus-ring flex h-11 w-full items-center border border-black/15 bg-white px-1 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] sm:w-40">
              <input
                value={slot}
                onChange={(event) => setSlot(event.target.value.toUpperCase())}
                placeholder="A1, G2..."
                aria-label="Exam slot"
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-black focus:outline-none placeholder:text-black/45 dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/45"
              />
            </div>
          </label>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className={sectionLabel}>How you study</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {preferenceOptions.map((option) => {
              const active = preferences.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => togglePreference(option.id)}
                  className={`${chipBase} ${active ? chipActive : chipIdle}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs leading-5 text-black/55 dark:text-[#D5D5D5]/55">
            Pick as many as you like. ExamCooker weights the queue toward what you
            actually want to do at 2am.
          </p>
        </section>
      </div>

      <section className="flex flex-col gap-4 border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 text-black dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222] sm:p-5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-black/70 dark:text-[#D5D5D5]/70">
          What happens next
        </span>
        <ol className="grid gap-2 text-xs leading-5 text-black/75 dark:text-[#D5D5D5]/75 sm:text-sm sm:leading-6">
          <li>1. Confirm the matched syllabus instead of trusting filename guesses.</li>
          <li>2. Pick the exact topics coming for your exam, plus custom ones.</li>
          <li>3. Earlier-slot reports and past papers come before any web research.</li>
          <li>4. Get a prioritized queue with clocks, evidence, and skip labels.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Link
            href={
              selectedCourse
                ? getCoursePastPapersPath(selectedCourse.code)
                : "/past_papers"
            }
            prefetch
            aria-disabled={!readyToContinue}
            className={`ec-press inline-flex h-11 items-center justify-center gap-2 border px-4 text-sm font-bold transition ${
              readyToContinue
                ? "border-black bg-white text-black hover:bg-black hover:text-white dark:border-[#3BF4C7] dark:bg-transparent dark:text-[#3BF4C7] dark:hover:bg-[#3BF4C7] dark:hover:text-[#0C1222]"
                : "pointer-events-none border-black/20 bg-white/60 text-black/40 dark:border-[#D5D5D5]/20 dark:bg-transparent dark:text-[#D5D5D5]/40"
            }`}
          >
            Continue
            <span aria-hidden>→</span>
          </Link>
          {!readyToContinue && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-black/50 dark:text-[#D5D5D5]/50">
              Pick a course and exam to continue
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
