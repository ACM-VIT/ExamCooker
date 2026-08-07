"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus, Search, X } from "lucide-react";
import { examTypeValues, type ExamType } from "@/db/enums";
import { examTypeLabel } from "@/lib/exam-slug";
import type { CourseSearchRecord } from "@/lib/data/course-catalog";
import { GradientText } from "@/app/components/landing/landing";
import type { StudyPreferenceMode } from "@/lib/study-brain/schemas";
import type { ComposerConfig } from "./sample-plan";
import { BUILD_VERBS, pickFrom } from "./copy";

type Props = {
  courses: CourseSearchRecord[];
  initialCourseCode?: string;
  initialExam?: ExamType | "";
  initialSlot?: string;
  initialPreferences?: StudyPreferenceMode[];
  initialTopics?: string[];
  onCourseChange?: (course: CourseSearchRecord | null) => void;
  onBuild: (config: ComposerConfig) => void;
};

const PRIMARY_EXAMS: ExamType[] = ["CAT_1", "CAT_2", "FAT", "MID", "QUIZ"];
const MORE_EXAMS: ExamType[] = examTypeValues.filter(
  (value) => !PRIMARY_EXAMS.includes(value),
);

const PREFERENCES: Array<{ id: StudyPreferenceMode; label: string }> = [
  { id: "past_papers", label: "Past papers" },
  { id: "videos", label: "Videos" },
  { id: "notes", label: "Notes" },
  { id: "solved_examples", label: "Solved examples" },
  { id: "quick_summaries", label: "Summaries" },
  { id: "mixed", label: "A bit of everything" },
];

const TOPIC_SUGGESTIONS = ["Numericals", "Derivations", "Definitions", "Diagrams"];

const chipBase =
  "ec-press inline-flex h-9 items-center gap-1.5 border px-3.5 text-sm font-semibold transition-colors";
const chipActive =
  "border-black bg-[#5FC4E7] text-black dark:border-[#5FC4E7]/60 dark:bg-[#5FC4E7]/15 dark:text-[#D5D5D5]";
const chipIdle =
  "border-black/15 bg-white/60 text-black/70 hover:border-black/40 hover:bg-white dark:border-[#D5D5D5]/15 dark:bg-transparent dark:text-[#D5D5D5]/70 dark:hover:border-[#D5D5D5]/40 dark:hover:bg-white/[0.04]";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-[#D5D5D5]/45">
      {children}
    </p>
  );
}

export default function Composer({
  courses,
  initialCourseCode = "",
  initialExam = "",
  initialSlot = "",
  initialPreferences,
  initialTopics,
  onCourseChange,
  onBuild,
}: Props) {
  const initialCourse = useMemo(
    () =>
      courses.find(
        (course) =>
          course.code.toUpperCase() === initialCourseCode.toUpperCase(),
      ) ?? null,
    [courses, initialCourseCode],
  );

  const [courseQuery, setCourseQuery] = useState(
    initialCourse ? `${initialCourse.code} ${initialCourse.title}` : "",
  );
  const [selectedCourse, setSelectedCourse] = useState<CourseSearchRecord | null>(
    initialCourse,
  );
  const [examType, setExamType] = useState<ExamType | "">(initialExam);
  const [slot, setSlot] = useState(initialSlot.toUpperCase());
  const [preferences, setPreferences] = useState<StudyPreferenceMode[]>(
    initialPreferences ?? ["past_papers", "mixed"],
  );
  const [topics, setTopics] = useState<string[]>(initialTopics ?? []);
  const [topicDraft, setTopicDraft] = useState("");
  const [showMoreExams, setShowMoreExams] = useState(
    Boolean(initialExam) && MORE_EXAMS.includes(initialExam as ExamType),
  );

  const buildVerb = pickFrom(BUILD_VERBS, `${selectedCourse?.code ?? ""}:${examType}`);

  useEffect(() => {
    onCourseChange?.(selectedCourse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse]);

  const matches = useMemo(() => {
    const query = normalize(courseQuery);
    if (!query) return [];
    return courses
      .filter((course) =>
        normalize(
          `${course.code} ${course.title} ${course.aliases.join(" ")}`,
        ).includes(query),
      )
      .slice(0, 6);
  }, [courseQuery, courses]);

  const togglePreference = (id: StudyPreferenceMode) => {
    setPreferences((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const addTopic = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setTopics((current) =>
      current.some((topic) => topic.toLowerCase() === value.toLowerCase()) ||
      current.length >= 12
        ? current
        : [...current, value],
    );
    setTopicDraft("");
  };

  const ready = Boolean(selectedCourse && examType);

  const handleBuild = () => {
    if (!selectedCourse || !examType) return;
    onBuild({ course: selectedCourse, examType, slot, preferences, topics });
  };

  return (
    <div className="flex w-full max-w-3xl flex-col gap-9">
      <header
        className="sp-aura sp-rise flex flex-col gap-4"
        style={{ ["--sp-i" as string]: 0 }}
      >
        <div className="sp-rule" />
        <h1 className="text-[2.1rem] font-extrabold leading-[1.04] tracking-[-0.02em] text-black dark:text-[#D5D5D5] sm:text-[3.25rem]">
          Make a <GradientText>study plan</GradientText>.
        </h1>
        <p className="max-w-xl text-sm leading-6 text-black/60 dark:text-[#D5D5D5]/60 sm:text-base">
          Pick your course, exam, and slot. ExamCooker orders what to study using
          the syllabus, past papers, and what earlier slots reported.
        </p>
      </header>

      {/* Course */}
      <section
        className="sp-rise flex flex-col gap-3"
        style={{ ["--sp-i" as string]: 1 }}
      >
        <Label>Course</Label>
        {selectedCourse ? (
          <div className="flex items-center gap-4 border-2 border-black bg-[#5FC4E7] p-4 text-black dark:border-[#5FC4E7]/40 dark:bg-white/10 dark:text-[#D5D5D5]">
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold uppercase tracking-wide text-black/70 dark:text-[#D5D5D5]/70">
                {selectedCourse.code}
              </p>
              <p className="truncate text-base font-bold leading-snug">
                {selectedCourse.title}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-black/55 dark:text-[#D5D5D5]/55">
                {selectedCourse.paperCount} paper
                {selectedCourse.paperCount === 1 ? "" : "s"}, {selectedCourse.noteCount}{" "}
                note{selectedCourse.noteCount === 1 ? "" : "s"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCourse(null);
                setCourseQuery("");
              }}
              className="ec-press ml-auto inline-flex h-9 shrink-0 items-center px-3 text-xs font-bold text-black/70 underline-offset-4 transition-colors hover:text-black hover:underline dark:text-[#D5D5D5]/70 dark:hover:text-[#D5D5D5]"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="sp-focus flex h-14 items-center border border-black/15 bg-white px-4 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]">
              <Search className="size-5 shrink-0 text-black/30 dark:text-[#D5D5D5]/35" strokeWidth={2.25} />
              <input
                type="text"
                inputMode="search"
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                aria-label="Search for a course"
                value={courseQuery}
                onChange={(event) => setCourseQuery(event.target.value)}
                placeholder="Search a course or code"
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-base text-black focus:outline-none placeholder:text-black/35 dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/40"
              />
              {courseQuery ? (
                <button
                  type="button"
                  onClick={() => setCourseQuery("")}
                  aria-label="Clear search"
                  className="ec-press text-black/35 hover:text-black dark:text-[#D5D5D5]/35 dark:hover:text-[#D5D5D5]"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            {!courseQuery.trim() ? (
              <p className="text-sm text-black/45 dark:text-[#D5D5D5]/45">
                Search for a course, or pick an upcoming exam below.
              </p>
            ) : matches.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {matches.map((course, index) => (
                  <button
                    key={course.id}
                    type="button"
                    style={{ ["--sp-i" as string]: index }}
                    onClick={() => {
                      setSelectedCourse(course);
                      setCourseQuery(`${course.code} ${course.title}`);
                    }}
                    className="sp-rise ec-card-lift ec-press group flex h-full flex-col gap-1.5 border-2 border-[#5FC4E7] bg-[#5FC4E7] p-3 text-left text-black transition-colors dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222]"
                  >
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-black/70 dark:text-[#D5D5D5]/70">
                      {course.code}
                    </span>
                    <span className="line-clamp-2 text-sm font-bold leading-snug">
                      {course.title}
                    </span>
                    <span className="mt-auto pt-1 text-[11px] tabular-nums text-black/55 dark:text-[#D5D5D5]/55">
                      {course.paperCount} paper
                      {course.paperCount === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-black/50 dark:text-[#D5D5D5]/50">
                No match. Try the course code, like BCSE202L.
              </p>
            )}
          </>
        )}
      </section>

      {selectedCourse ? (
        <>
          {/* Exam */}
          <section
            className="sp-rise flex flex-col gap-3"
            style={{ ["--sp-i" as string]: 2 }}
          >
            <Label>Exam and slot</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PRIMARY_EXAMS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setExamType(examType === value ? "" : value)}
                  className={`${chipBase} ${examType === value ? chipActive : chipIdle}`}
                >
                  {examTypeLabel(value)}
                </button>
              ))}
              {showMoreExams ? (
                MORE_EXAMS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setExamType(examType === value ? "" : value)}
                    className={`${chipBase} ${examType === value ? chipActive : chipIdle}`}
                  >
                    {examTypeLabel(value)}
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => setShowMoreExams(true)}
                  className="inline-flex h-9 items-center px-2 text-sm font-medium text-black/50 underline-offset-4 hover:underline dark:text-[#D5D5D5]/50"
                >
                  More
                </button>
              )}
            </div>
            <div className="sp-focus flex h-11 w-full items-center border border-black/15 bg-white px-3 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] sm:w-52">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-black/40 dark:text-[#D5D5D5]/40">
                Slot
              </span>
              <input
                value={slot}
                onChange={(event) => setSlot(event.target.value.toUpperCase())}
                placeholder="optional"
                aria-label="Exam slot"
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-black focus:outline-none placeholder:font-normal placeholder:text-black/35 dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/35"
              />
            </div>
          </section>

          {/* Topics */}
          <section
            className="sp-rise flex flex-col gap-3"
            style={{ ["--sp-i" as string]: 3 }}
          >
            <Label>Topics you know are coming (optional)</Label>
            <div className="sp-focus flex h-11 items-center border border-black/15 bg-white px-3 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]">
              <input
                value={topicDraft}
                onChange={(event) => setTopicDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTopic(topicDraft);
                  }
                }}
                placeholder="Add a topic and press enter"
                aria-label="Add a topic"
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-black focus:outline-none placeholder:text-black/40 dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/40"
              />
              <button
                type="button"
                onClick={() => addTopic(topicDraft)}
                disabled={!topicDraft.trim()}
                aria-label="Add topic"
                className="ec-press inline-flex size-7 items-center justify-center text-black/45 hover:text-black disabled:opacity-30 dark:text-[#D5D5D5]/45 dark:hover:text-[#D5D5D5]"
              >
                <Plus className="size-4" strokeWidth={2.5} />
              </button>
            </div>
            {topics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex h-8 items-center gap-1.5 border border-black/20 bg-[#5FC4E7]/40 px-2.5 text-sm font-semibold text-black dark:border-[#D5D5D5]/20 dark:bg-white/10 dark:text-[#D5D5D5]"
                  >
                    {topic}
                    <button
                      type="button"
                      onClick={() =>
                        setTopics((current) =>
                          current.filter((item) => item !== topic),
                        )
                      }
                      aria-label={`Remove ${topic}`}
                      className="ec-press text-black/45 hover:text-black dark:text-[#D5D5D5]/45 dark:hover:text-[#D5D5D5]"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-black/40 dark:text-[#D5D5D5]/40">
                  Try
                </span>
                {TOPIC_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => addTopic(suggestion)}
                    className="ec-press inline-flex h-8 items-center gap-1 border border-dashed border-black/25 px-2.5 text-sm font-medium text-black/55 transition-colors hover:border-solid hover:border-black/50 hover:text-black dark:border-[#D5D5D5]/25 dark:text-[#D5D5D5]/55 dark:hover:border-[#D5D5D5]/50 dark:hover:text-[#D5D5D5]"
                  >
                    <Plus className="size-3" />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Style */}
          <section
            className="sp-rise flex flex-col gap-3"
            style={{ ["--sp-i" as string]: 4 }}
          >
            <Label>How you want to study</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PREFERENCES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => togglePreference(option.id)}
                  className={`${chipBase} ${
                    preferences.includes(option.id) ? chipActive : chipIdle
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          {/* Build */}
          <div
            className="sp-rise flex flex-col gap-2 pt-1"
            style={{ ["--sp-i" as string]: 5 }}
          >
            <button
              type="button"
              onClick={handleBuild}
              disabled={!ready}
              className={`ec-press group inline-flex h-12 w-full items-center justify-center gap-2 border-2 text-sm font-bold transition-colors sm:w-auto sm:self-start sm:px-8 ${
                ready
                  ? "sp-cta-sheen border-black bg-[#5FC4E7] text-black hover:border-transparent hover:bg-gradient-to-r hover:from-[#253EE0] hover:to-[#27BAEC] hover:text-white dark:border-[#5FC4E7]/40 dark:bg-[#5FC4E7]/12 dark:text-[#D5D5D5]"
                  : "cursor-not-allowed border-black/15 bg-white/50 text-black/35 dark:border-[#D5D5D5]/15 dark:bg-transparent dark:text-[#D5D5D5]/35"
              }`}
            >
              {buildVerb}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2.5}
              />
            </button>
            {!ready ? (
              <p className="text-xs text-black/40 dark:text-[#D5D5D5]/40">
                Choose an exam to build your plan.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
