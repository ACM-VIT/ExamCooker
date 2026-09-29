import type { Campus, ExamType, Semester } from "@/db";
import {
  getCourseDetailByCode,
  searchCourseGrid,
  type CourseGridItem,
} from "@/lib/data/course-catalog";
import { getNotesCount, getNotesPage } from "@/lib/data/notes";
import { getResourcesCount, getResourcesPage } from "@/lib/data/resources";
import { searchCliPapers, type CliPaperSearchFilters } from "@/lib/cli/papers";
import { getSyllabusCount, getSyllabusPage } from "@/lib/data/syllabus";
import {
  absoluteUrl,
  formatSyllabusDisplayName,
  getCoursePastPapersPath,
  getCourseResourcesPath,
  getCourseSyllabusPath,
  parseSubjectName,
  parseSyllabusName,
} from "@/lib/seo";
import {
  findVinCourseByNames,
  getVinCourses,
  type VinCourse,
} from "@/lib/data/vin-together";
import { normalizeCourseCode } from "@/lib/course-tags";
import {
  getDatabaseResourcePageRequests,
  MAX_PAGE_SIZE,
  shouldQueryDatabaseResources,
} from "@/lib/mcp/resource-pagination";
import { toResourceId } from "@/lib/mcp/resource-id";
const DEFAULT_PAGE_SIZE = 20;

export type McpPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

export type McpCourseItem = {
  id: string;
  code: string;
  title: string;
  paperCount: number;
  noteCount: number;
  url: string;
};

export type McpNoteItem = {
  id: string;
  title: string;
  courseCode: string | null;
  courseTitle: string | null;
  url: string;
};

export type McpPastPaperItem = {
  id: string;
  title: string;
  url: string;
  course: { code: string; title: string | null } | null;
  examType: ExamType | null;
  examTypeLabel: string | null;
  year: number | null;
  slot: string | null;
  semester: Semester | null;
  campus: Campus | null;
  hasAnswerKey: boolean | null;
};

export type McpSyllabusItem = {
  id: string;
  name: string;
  title: string;
  courseCode: string | null;
  courseName: string | null;
  url: string;
};

export type McpResourceItem = {
  id: string;
  title: string;
  courseCode: string | null;
  courseName: string | null;
  year: string | null;
  url: string;
};

type ResourceOrigin = "ExamCooker" | "VInTogether";
type McpResourceCandidate = McpResourceItem & {
  origin: ResourceOrigin;
};

type PaginationInput = {
  page?: number;
  pageSize?: number;
};

type TextListInput = PaginationInput & {
  query?: string;
};

type CourseListInput = TextListInput & {
  withPapers?: boolean;
  withNotes?: boolean;
};
type ResourceListInput = TextListInput & {
  courseCode?: string;
  year?: string;
};

export type McpPastPaperListInput = Omit<
  CliPaperSearchFilters,
  "includeDrafts" | "page" | "limit"
> & PaginationInput;

function normalizePagination(input: PaginationInput) {
  const page = Number.isFinite(input.page)
    ? Math.max(1, Math.floor(input.page as number))
    : 1;
  const requestedPageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(requestedPageSize)))
    : DEFAULT_PAGE_SIZE;

  return { page, pageSize };
}

function makePage<T>(items: T[], total: number, page: number, pageSize: number): McpPage<T> {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
  };
}

function stripPdfExtension(value: string) {
  return value.replace(/\.pdf$/i, "").trim();
}

function inferCourseCodeFromTitle(title: string) {
  const match = /\b([A-Z]{2,5}\d{2,4}[A-Z]?)\b/.exec(title);
  return match?.[1] ?? null;
}

function mapCourse(course: CourseGridItem): McpCourseItem {
  return {
    id: toResourceId({ kind: "course", id: course.code }),
    code: course.code,
    title: course.title,
    paperCount: course.paperCount,
    noteCount: course.noteCount,
    url: absoluteUrl(getCoursePastPapersPath(course.code)),
  };
}

export async function listMcpCourses(
  input: CourseListInput = {},
): Promise<McpPage<McpCourseItem>> {
  const { page, pageSize } = normalizePagination(input);
  const courses = (await searchCourseGrid(input.query?.trim() ?? "")).filter((item) => {
    if (input.withPapers && item.paperCount === 0) return false;
    if (input.withNotes && item.noteCount === 0) return false;
    return true;
  });
  const offset = (page - 1) * pageSize;

  return makePage(
    courses.slice(offset, offset + pageSize).map(mapCourse),
    courses.length,
    page,
    pageSize,
  );
}

export async function listMcpNotes(
  input: TextListInput & { courseCode?: string } = {},
): Promise<McpPage<McpNoteItem>> {
  const { page, pageSize } = normalizePagination(input);
  const search = input.query?.trim() ?? "";
  const rawCourseCode = input.courseCode?.trim() ?? "";
  const normalizedCourseCode = rawCourseCode ? normalizeCourseCode(rawCourseCode) : null;

  if (rawCourseCode && !normalizedCourseCode) {
    return makePage([], 0, page, pageSize);
  }

  let courseId: string | null = null;
  let selectedCourse: { code: string; title: string } | null = null;
  if (normalizedCourseCode) {
    const course = await getCourseDetailByCode(normalizedCourseCode);
    if (!course) return makePage([], 0, page, pageSize);
    courseId = course.id;
    selectedCourse = { code: course.code, title: course.title };
  }

  const [total, notes] = await Promise.all([
    getNotesCount({ search, tags: [], courseId }),
    getNotesPage({ search, tags: [], courseId, page, pageSize }),
  ]);

  return makePage(
    notes.map((note) => {
      const courseCode =
        note.courseCode ?? selectedCourse?.code ?? inferCourseCodeFromTitle(note.title);
      return {
        id: toResourceId({ kind: "note", id: note.id }),
        title: stripPdfExtension(note.title),
        courseCode,
        courseTitle: note.courseTitle ?? selectedCourse?.title ?? null,
        url: absoluteUrl(`/notes/${encodeURIComponent(note.id)}`),
      };
    }),
    total,
    page,
    pageSize,
  );
}

export async function listMcpPastPapers(
  input: McpPastPaperListInput,
): Promise<McpPage<McpPastPaperItem>> {
  const { page, pageSize } = normalizePagination(input);
  const result = await searchCliPapers(absoluteUrl("/"), {
    query: input.query ?? null,
    course: input.course ?? null,
    examType: input.examType ?? null,
    year: input.year ?? null,
    slot: input.slot ?? null,
    semester: input.semester ?? null,
    campus: input.campus ?? null,
    answerKeysOnly: input.answerKeysOnly ?? false,
    tags: input.tags ?? null,
    tagMode: input.tagMode ?? "any",
    includeDrafts: false,
    page,
    limit: pageSize,
  });

  return makePage(
    result.papers.map((paper) => ({
      id: toResourceId({ kind: "past_paper", id: paper.id }),
      title: stripPdfExtension(paper.title),
      url: paper.pageUrl,
      course: paper.course,
      examType: paper.examType,
      examTypeLabel: paper.examTypeLabel,
      year: paper.year,
      slot: paper.slot,
      semester: paper.semester,
      campus: paper.campus,
      hasAnswerKey: paper.hasAnswerKey,
    })),
    result.total,
    page,
    pageSize,
  );
}

export async function listMcpSyllabi(
  input: TextListInput = {},
): Promise<McpPage<McpSyllabusItem>> {
  const { page, pageSize } = normalizePagination(input);
  const search = input.query?.trim() ?? "";
  const [total, syllabi] = await Promise.all([
    getSyllabusCount({ search }),
    getSyllabusPage({ search, page, pageSize }),
  ]);

  return makePage(
    syllabi.map((syllabus) => {
      const parsed = parseSyllabusName(syllabus.name);
      const title =
        parsed.courseCode && parsed.courseName
          ? `${parsed.courseCode} - ${parsed.courseName}`
          : formatSyllabusDisplayName(syllabus.name);
      const path = parsed.courseCode
        ? getCourseSyllabusPath(parsed.courseCode)
        : `/syllabus/${encodeURIComponent(syllabus.id)}`;

      return {
        id: toResourceId({ kind: "syllabus", id: syllabus.id }),
        name: syllabus.name,
        title,
        courseCode: parsed.courseCode,
        courseName: parsed.courseName,
        url: absoluteUrl(path),
      };
    }),
    total,
    page,
    pageSize,
  );
}
function mapDatabaseResource(
  resource: { id: string; name: string },
): McpResourceCandidate {
  const parsed = parseSubjectName(resource.name);
  const path = parsed.courseCode
    ? getCourseResourcesPath(parsed.courseCode)
    : `/resources/${encodeURIComponent(resource.id)}`;

  return {
    id: toResourceId({ kind: "resource", id: resource.id }),
    title: parsed.courseCode
      ? `${parsed.courseCode} - ${parsed.courseName}`
      : parsed.courseName,
    courseCode: parsed.courseCode,
    courseName: parsed.courseName,
    year: null,
    url: absoluteUrl(path),
    origin: "ExamCooker",
  };
}

function mapVinTogetherResource(course: VinCourse): McpResourceCandidate {
  return {
    id: toResourceId({ kind: "resource", id: course.slug }),
    title: `${course.displayName} resources`,
    courseCode: null,
    courseName: course.displayName,
    year: course.year,
    url: absoluteUrl(`/resources/${encodeURIComponent(course.slug)}`),
    origin: "VInTogether",
  };
}
async function getVinTogetherResources(
  input: ResourceListInput,
): Promise<McpResourceCandidate[]> {
  const query = input.query?.trim() ?? "";
  const year = input.year?.trim() ?? "";
  let courses = getVinCourses({
    search: query,
    year: year || undefined,
  });

  const rawCourseCode = input.courseCode?.trim() ?? "";
  if (rawCourseCode) {
    const courseDetail = await getCourseDetailByCode(normalizeCourseCode(rawCourseCode));
    const remoteCourse = courseDetail
      ? findVinCourseByNames([
          courseDetail.code,
          courseDetail.title,
          ...courseDetail.aliases,
        ])
      : getVinCourses({ year: year || undefined }).find((course) =>
          [course.id, course.slug, course.remotePath.replace(/^\//, "")]
            .some((value) => value.toLowerCase() === rawCourseCode.toLowerCase()),
        );

    courses = remoteCourse
      ? courses.filter((course) => course.id === remoteCourse.id)
      : [];
  }

  return courses.map(mapVinTogetherResource);
}

async function getDatabaseResourceWindow(
  input: ResourceListInput,
  offset: number,
  limit: number,
): Promise<McpResourceCandidate[]> {
  if (limit <= 0) return [];

  const pageRequests = getDatabaseResourcePageRequests(offset, limit);
  const pages = await Promise.all(
    pageRequests.map(({ page, pageSize }) =>
      getResourcesPage({
        search: input.query?.trim() ?? "",
        courseCode: input.courseCode?.trim()
          ? normalizeCourseCode(input.courseCode)
          : undefined,
        page,
        pageSize,
      }),
    ),
  );
  const databasePageOffset = offset % MAX_PAGE_SIZE;

  return pages
    .flat()
    .slice(databasePageOffset, databasePageOffset + limit)
    .map(mapDatabaseResource);
}
export async function listMcpResources(
  input: ResourceListInput = {},
): Promise<McpPage<McpResourceItem>> {
  const { page, pageSize } = normalizePagination(input);
  const search = input.query?.trim() ?? "";
  const rawCourseCode = input.courseCode?.trim() ?? "";
  const normalizedCourseCode = rawCourseCode ? normalizeCourseCode(rawCourseCode) : null;

  if (rawCourseCode && !normalizedCourseCode) {
    return makePage([], 0, page, pageSize);
  }
  const includeDatabaseResources = shouldQueryDatabaseResources(input.year);

  const [databaseTotal, vinTogetherResources] = await Promise.all([
    includeDatabaseResources
      ? getResourcesCount({
          search,
          courseCode: normalizedCourseCode ?? undefined,
        })
      : Promise.resolve(0),
    getVinTogetherResources(input),
  ]);

  const total = databaseTotal + vinTogetherResources.length;
  const offset = (page - 1) * pageSize;
  const databaseItems =
    offset < databaseTotal
      ? await getDatabaseResourceWindow(
          input,
          offset,
          Math.min(pageSize, databaseTotal - offset),
        )
      : [];
  const vinTogetherOffset = Math.max(0, offset - databaseTotal);
  const vinTogetherItems = vinTogetherResources.slice(
    vinTogetherOffset,
    vinTogetherOffset + pageSize - databaseItems.length,
  );

  return makePage(
    [...databaseItems, ...vinTogetherItems].map(({ origin: _origin, ...item }) => item),
    total,
    page,
    pageSize,
  );
}

