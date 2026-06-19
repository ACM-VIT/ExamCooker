"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock3, FileText, Search, Sparkles } from "lucide-react";
import type { CourseSearchRecord } from "@/lib/data/course-catalog";
import { examTypeValues } from "@/db/enums";
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
  description: string;
}> = [
  { id: "past_papers", label: "Past-paper practice", description: "Prioritize questions and patterns." },
  { id: "videos", label: "Video explanations", description: "Use good lectures when they save time." },
  { id: "notes", label: "Notes and reading", description: "Keep it text-first and skimmable." },
  { id: "solved_examples", label: "Solved examples", description: "Work through examples before papers." },
  { id: "quick_summaries", label: "Quick summaries", description: "Fast revision blocks first." },
  { id: "mixed", label: "Mixed mode", description: "Let ExamCooker balance the queue." },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export default function StudyPlanBuilder({
  courses,
  initialCourse = "",
  initialExam = "",
  initialSlot = "",
}: Props) {
  const [courseQuery, setCourseQuery] = useState(initialCourse);
  const [selectedCourseCode, setSelectedCourseCode] = useState(initialCourse.toUpperCase());
  const [examType, setExamType] = useState(initialExam.toUpperCase());
  const [slot, setSlot] = useState(initialSlot.toUpperCase());
  const [preferences, setPreferences] = useState<StudyPreferenceMode[]>(["past_papers", "mixed"]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.code.toUpperCase() === selectedCourseCode),
    [courses, selectedCourseCode],
  );

  const matches = useMemo(() => {
    const query = normalize(courseQuery);
    if (!query) return courses.slice(0, 8);
    return courses
      .filter((course) => {
        const haystack = normalize(`${course.code} ${course.title} ${course.aliases.join(" ")}`);
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [courseQuery, courses]);

  const togglePreference = (id: StudyPreferenceMode) => {
    setPreferences((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
      <section className="border border-black/15 bg-white p-4 shadow-[0_4px_28px_-14px_rgba(0,0,0,0.25)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:shadow-[0_4px_28px_-14px_rgba(0,0,0,0.6)] sm:p-5">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-black/45 dark:text-[#D5D5D5]/45">
          <Sparkles className="size-4" aria-hidden />
          Study Brain
        </div>
        <h1 className="mt-3 text-pretty text-3xl font-black leading-none text-black dark:text-[#D5D5D5] sm:text-5xl">
          Build the queue that makes sense for your exam.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-black/65 dark:text-[#D5D5D5]/65 sm:text-base">
          Choose the course, exam, slot, and how you actually study. ExamCooker
          will use syllabus topics, previous papers, slot reports, and web research
          without making it feel like AI homework.
        </p>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-black/50 dark:text-[#D5D5D5]/50">
              What do you wanna study?
            </span>
            <div className="flex items-center gap-2 border border-black/15 bg-[#F6FBFC] px-3 py-2 dark:border-[#D5D5D5]/15 dark:bg-[#08111F]">
              <Search className="size-4 shrink-0 text-black/45 dark:text-[#D5D5D5]/45" aria-hidden />
              <input
                value={courseQuery}
                onChange={(event) => {
                  setCourseQuery(event.target.value);
                  setSelectedCourseCode("");
                }}
                placeholder="Mechanics, BCME102L, DSA..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-black outline-none placeholder:text-black/35 dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/35"
              />
            </div>
          </label>

          <div className="grid gap-2">
            {matches.map((course) => {
              const active = course.code.toUpperCase() === selectedCourseCode;
              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => {
                    setSelectedCourseCode(course.code.toUpperCase());
                    setCourseQuery(`${course.code} · ${course.title}`);
                  }}
                  className={`flex items-center justify-between gap-3 border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-black bg-black text-white dark:border-[#3BF4C7] dark:bg-[#3BF4C7] dark:text-[#06101F]"
                      : "border-black/10 bg-white hover:border-black/25 hover:bg-black/5 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222] dark:hover:border-[#3BF4C7]/40 dark:hover:bg-white/5"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-black">{course.code}</span>
                    <span className="block truncate text-xs opacity-70">{course.title}</span>
                  </span>
                  {active && <Check className="size-4 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_0.55fr]">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-black/50 dark:text-[#D5D5D5]/50">
                Exam type
              </span>
              <select
                value={examType}
                onChange={(event) => setExamType(event.target.value)}
                className="h-11 border border-black/15 bg-white px-3 text-sm font-bold text-black outline-none dark:border-[#D5D5D5]/15 dark:bg-[#08111F] dark:text-[#D5D5D5]"
              >
                <option value="">Pick exam</option>
                {examTypeValues.map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-black/50 dark:text-[#D5D5D5]/50">
                Slot
              </span>
              <input
                value={slot}
                onChange={(event) => setSlot(event.target.value.toUpperCase())}
                placeholder="A1, G2..."
                className="h-11 border border-black/15 bg-white px-3 text-sm font-bold text-black outline-none placeholder:text-black/35 dark:border-[#D5D5D5]/15 dark:bg-[#08111F] dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/35"
              />
            </label>
          </div>
        </div>
      </section>

      <aside className="flex flex-col gap-5">
        <section className="border border-black/15 bg-white p-4 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] sm:p-5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-black/45 dark:text-[#D5D5D5]/45">
            <Clock3 className="size-4" aria-hidden />
            Study style
          </div>
          <div className="mt-4 grid gap-2">
            {preferenceOptions.map((option) => {
              const active = preferences.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => togglePreference(option.id)}
                  className={`border px-3 py-3 text-left transition-colors ${
                    active
                      ? "border-black bg-black text-white dark:border-[#3BF4C7] dark:bg-[#3BF4C7] dark:text-[#06101F]"
                      : "border-black/10 bg-white hover:border-black/25 hover:bg-black/5 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222] dark:hover:border-[#3BF4C7]/40 dark:hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-black">{option.label}</span>
                      <span className="mt-0.5 block text-xs opacity-70">{option.description}</span>
                    </span>
                    {active && <Check className="size-4 shrink-0" aria-hidden />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="border border-black/15 bg-[#E7F8F8] p-4 dark:border-[#3BF4C7]/20 dark:bg-[#081A24] sm:p-5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-black/45 dark:text-[#D5D5D5]/45">
            <FileText className="size-4" aria-hidden />
            What happens next
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-black/70 dark:text-[#D5D5D5]/70">
            <li>Confirm the matched syllabus instead of trusting filename magic.</li>
            <li>Pick exact topics from extracted modules, plus custom topics if needed.</li>
            <li>Use earlier-slot reports and past papers before external research.</li>
            <li>Get a prioritized queue with clocks, evidence, and skip-if-cooked labels.</li>
          </ul>
          <Link
            href={selectedCourse ? `/past_papers/${selectedCourse.code}` : "/past_papers"}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-4 py-3 text-sm font-black text-white transition-colors hover:bg-[#0D5875] dark:border-[#3BF4C7] dark:bg-[#3BF4C7] dark:text-[#06101F] dark:hover:bg-[#7fffe0]"
          >
            Continue from course context
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      </aside>
    </div>
  );
}
