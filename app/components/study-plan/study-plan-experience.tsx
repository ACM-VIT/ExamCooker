"use client";

import { useEffect, useState } from "react";
import type { CourseSearchRecord } from "@/lib/data/course-catalog";
import { parseExamTypeInput } from "@/lib/exam-slug";
import type { StudyPlan } from "@/lib/study-brain/schemas";
import Composer from "./composer";
import Generating from "./generating";
import PlanView from "./plan-view";
import UpcomingExams from "./upcoming-exams";
import { buildSamplePlan, type ComposerConfig } from "./sample-plan";

type CoursePick = {
  id: string;
  code: string;
  title: string;
  paperCount: number;
};

type Props = {
  courses: CourseSearchRecord[];
  suggested: CoursePick[];
  popular: CoursePick[];
  initialCourse?: string;
  initialExam?: string;
  initialSlot?: string;
};

type Phase = "compose" | "building" | "plan";

function scrollToTop() {
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

export default function StudyPlanExperience({
  courses,
  suggested,
  popular,
  initialCourse = "",
  initialExam = "",
  initialSlot = "",
}: Props) {
  const [phase, setPhase] = useState<Phase>("compose");
  const [config, setConfig] = useState<ComposerConfig | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [quickCourse, setQuickCourse] = useState<string | null>(null);
  const [hasCourse, setHasCourse] = useState(false);

  useEffect(() => {
    scrollToTop();
  }, [phase]);

  const handleBuild = (next: ComposerConfig) => {
    setConfig(next);
    setPlan(buildSamplePlan(next));
    setPhase("building");
  };

  const handlePick = (code: string) => {
    setQuickCourse(code);
    scrollToTop();
  };

  if (phase === "building" && config) {
    return <Generating config={config} onDone={() => setPhase("plan")} />;
  }

  if (phase === "plan" && plan) {
    return <PlanView plan={plan} onReset={() => setPhase("compose")} />;
  }

  const seedCourse = quickCourse ?? config?.course.code ?? initialCourse;

  return (
    <div className="flex flex-col gap-12 lg:gap-16">
      <Composer
        key={seedCourse || "composer"}
        courses={courses}
        initialCourseCode={seedCourse}
        initialExam={config?.examType ?? parseExamTypeInput(initialExam) ?? ""}
        initialSlot={config?.slot ?? initialSlot}
        initialPreferences={config?.preferences}
        initialTopics={config?.topics}
        onCourseChange={(course) => setHasCourse(Boolean(course))}
        onBuild={handleBuild}
      />
      {!hasCourse ? (
        <>
          <UpcomingExams courses={suggested} onPick={handlePick} />
          <UpcomingExams
            title="Most material"
            hint="Browse by course"
            courses={popular}
            onPick={handlePick}
          />
        </>
      ) : null}
    </div>
  );
}
