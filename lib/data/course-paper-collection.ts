import { cacheLife, cacheTag } from "next/cache";
import { normalizeCourseCode } from "@/lib/course-tags";
import { getCourseDetailByCode, getCourseTitleVariants } from "./course-catalog";
import { getCoursePaperRows } from "./course-papers";
import { getUpcomingExamsForCoursesCached } from "./upcoming-exams";

export async function getCoursePaperCollection(code: string) {
  const normalized = normalizeCourseCode(code);
  if (!normalized) return null;
  return getCoursePaperCollectionCached(normalized);
}

/** One public snapshot avoids serial remote reads while rendering a course. */
async function getCoursePaperCollectionCached(code: string) {
  "use cache";
  cacheTag("courses", "notes", "past_papers", "upcoming_exams");
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  const course = await getCourseDetailByCode(code);
  if (!course) return null;
  const [courseOptions, rows, exams] = await Promise.all([
    getCourseTitleVariants(course.title),
    getCoursePaperRows(course.id),
    getUpcomingExamsForCoursesCached([course.id]),
  ]);
  // Keep dates, not a computed exam focus: elapsed exams are filtered at render
  // time. URL filters and identity are never inputs to this shared entry.
  return { course, courseOptions, rows, upcomingExams: exams.get(course.id) ?? [] };
}

export type CoursePaperCollection = NonNullable<Awaited<ReturnType<typeof getCoursePaperCollection>>>;
