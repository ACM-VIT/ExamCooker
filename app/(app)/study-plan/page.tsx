import type { Metadata } from "next";
import DirectionalTransition from "@/app/components/common/directional-transition";
import StudyPlanBuilder from "@/app/components/study-brain/study-plan-builder";
import StructuredData from "@/app/components/seo/structured-data";
import { getCoursePickerRecords } from "@/lib/data/course-catalog";
import { buildBreadcrumbList } from "@/lib/structured-data";

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
  const [params, courses] = await Promise.all([
    searchParams ?? Promise.resolve({} as SearchParams),
    getCoursePickerRecords(),
  ]);

  return (
    <DirectionalTransition>
      <main className="min-h-dvh bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
        <StructuredData
          data={[
            buildBreadcrumbList([
              { name: "Home", path: "/" },
              { name: "Study plan", path: "/study-plan" },
            ]),
          ]}
        />
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
          <StudyPlanBuilder
            courses={courses}
            initialCourse={params.course ?? ""}
            initialExam={params.exam ?? ""}
            initialSlot={params.slot ?? ""}
          />
        </div>
      </main>
    </DirectionalTransition>
  );
}
