import type { Metadata } from "next";
import DirectionalTransition from "@/app/components/common/directional-transition";
import StudyPlanExperience from "@/app/components/study-plan/study-plan-experience";
import StructuredData from "@/app/components/seo/structured-data";
import {
  getCoursePickerRecords,
  getUpcomingExamsCourseGrid,
  type CourseSearchRecord,
} from "@/lib/data/course-catalog";
import { buildBreadcrumbList } from "@/lib/structured-data";

type CoursePick = {
  id: string;
  code: string;
  title: string;
  paperCount: number;
};

type SearchParams = {
  course?: string;
  exam?: string;
  slot?: string;
};

export const metadata: Metadata = {
  title: "Study plan | ExamCooker",
  description:
    "Build a syllabus-grounded study queue from ExamCooker past papers, slot reports, resources, and web research.",
  alternates: { canonical: "/study-plan" },
};

export default async function StudyPlanPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const [params, courses, upcoming] = await Promise.all([
    searchParams ?? Promise.resolve({} as SearchParams),
    getCoursePickerRecords(),
    getUpcomingExamsCourseGrid(),
  ]);

  // Resolve the curated upcoming-exam courses to full search records (keeping
  // the curated order) so they can seed the planner as one-tap entry points.
  const byCode = new Map(courses.map((course) => [course.code, course]));
  const suggested: CoursePick[] = upcoming
    .map((item) => byCode.get(item.code))
    .filter((course): course is CourseSearchRecord => Boolean(course));

  // A second band of real entry points: the courses with the most material that
  // aren't already shown as upcoming exams. Always full, always useful.
  const upcomingCodes = new Set(upcoming.map((item) => item.code));
  const popularPicks: CoursePick[] = courses
    .filter((course) => !upcomingCodes.has(course.code) && course.paperCount > 0)
    .sort((a, b) => b.paperCount - a.paperCount)
    .slice(0, 12)
    .map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
      paperCount: course.paperCount,
    }));

  return (
    <DirectionalTransition>
      <main className="relative min-h-dvh overflow-hidden bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
        <StructuredData
          data={[
            buildBreadcrumbList([
              { name: "Home", path: "/" },
              { name: "Study plan", path: "/study-plan" },
            ]),
          ]}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[520px] bg-[radial-gradient(72%_100%_at_22%_-10%,rgba(39,186,236,0.10),transparent_62%)] dark:bg-[radial-gradient(72%_100%_at_22%_-10%,rgba(39,186,236,0.14),transparent_60%)]"
        />
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
          <StudyPlanExperience
            courses={courses}
            suggested={suggested}
            popular={popularPicks}
            initialCourse={params.course ?? ""}
            initialExam={params.exam ?? ""}
            initialSlot={params.slot ?? ""}
          />
        </div>
      </main>
    </DirectionalTransition>
  );
}
