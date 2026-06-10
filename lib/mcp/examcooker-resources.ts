import {
  getCourseDetailByCode,
  searchCourseGrid,
} from "@/lib/data/course-catalog";
import { getCliPastPaperDetail, searchCliPapers } from "@/lib/cli/papers";
import { getCourseNotesPage, getNotesPage } from "@/lib/data/notes";
import { getNoteDetail } from "@/lib/data/note-detail";
import { getSubjectByCourseCode, getSubjectDetail } from "@/lib/data/resources";
import { getSyllabusDetail } from "@/lib/data/syllabus-detail";
import {
  getSyllabusDetailByCourseCode,
  getSyllabusPage,
} from "@/lib/data/syllabus";
import {
  findVinCourseByNames,
  getVinCourseById,
  getVinCourses,
  type VinCourse,
} from "@/lib/data/vin-together";
import { normalizeCourseCode } from "@/lib/course-tags";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import {
  absoluteUrl,
  formatSyllabusDisplayName,
  getCourseNotesPath,
  getCoursePastPapersPath,
  getCourseResourcesPath,
  getCourseSyllabusPath,
  parseSubjectName,
  parseSyllabusName,
} from "@/lib/seo";
import { parseResourceRef, toResourceId, type ResourceRef } from "@/lib/mcp/resource-id";

export type McpSearchResult = {
  id: string;
  title: string;
  url: string;
};

export type McpSearchOutput = {
  results: McpSearchResult[];
};

export type McpFetchOutput = {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata?: Record<string, string | number | boolean | null>;
};

type InternalResult = McpSearchResult & {
  _courseCode?: string | null;
  _kindRank: number;
};
type SearchProvider = (query: string) => Promise<InternalResult[]> | InternalResult[];
type FetchProvider = (ref: ResourceRef) => Promise<McpFetchOutput | null>;

const MAX_SEARCH_RESULTS = 20;
const PER_TYPE_SEARCH_LIMIT = 5;
const COURSE_DETAIL_LIMIT = 10;

const KIND_RANK = {
  course: 0,
  past_paper: 1,
  note: 2,
  syllabus: 3,
  resource: 4,
} as const;

function stripPdfExtension(value: string) {
  return value.replace(/\.pdf$/i, "").trim();
}

function trimText(value: string, maxLength = 12000) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

function listItems(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None";
}

function compactMetadata(
  values: Record<string, string | number | boolean | null | undefined>,
) {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [
      string,
      string | number | boolean | null,
    ] => entry[1] !== undefined),
  );
}

function joinSections(sections: Array<string | null | undefined>) {
  return trimText(sections.filter(Boolean).join("\n\n"));
}

function dedupeAndSort(
  results: InternalResult[],
  coursePaperRank: Map<string, number>,
): McpSearchResult[] {
  const byId = new Map<string, { item: InternalResult; pos: number }>();
  results.forEach((item, pos) => {
    if (!byId.has(item.id)) byId.set(item.id, { item, pos });
  });
  const entries = Array.from(byId.values());
  entries.sort((a, b) => {
    const aRank = a.item._courseCode ? coursePaperRank.get(a.item._courseCode) ?? 0 : 0;
    const bRank = b.item._courseCode ? coursePaperRank.get(b.item._courseCode) ?? 0 : 0;
    if (aRank !== bRank) return bRank - aRank;
    if (a.item._kindRank !== b.item._kindRank) return a.item._kindRank - b.item._kindRank;
    return a.pos - b.pos;
  });
  return entries
    .slice(0, MAX_SEARCH_RESULTS)
    .map(({ item }) => ({ id: item.id, title: item.title, url: item.url }));
}

async function searchCourses(query: string): Promise<InternalResult[]> {
  const courses = await searchCourseGrid(query);
  const ranked = [...courses].sort(
    (a, b) =>
      b.paperCount - a.paperCount ||
      b.noteCount - a.noteCount ||
      a.code.localeCompare(b.code),
  );
  return ranked.slice(0, PER_TYPE_SEARCH_LIMIT).map((course) => {
    const signals = [
      course.paperCount ? `${course.paperCount} papers` : null,
      course.noteCount ? `${course.noteCount} notes` : null,
    ].filter(Boolean);
    return {
      id: toResourceId({ kind: "course", id: course.code }),
      title: `Course: ${course.code} - ${course.title}${
        signals.length ? ` (${signals.join(", ")})` : ""
      }`,
      url: absoluteUrl(getCoursePastPapersPath(course.code)),
      _courseCode: course.code,
      _kindRank: KIND_RANK.course,
    };
  });
}

// Notes have course code embedded in their filename, e.g. "...-BMAT202L.pdf".
// Pull it from the title since the data layer doesn't return the course relation.
function inferCourseCodeFromTitle(title: string): string | null {
  const m = /\b([A-Z]{2,5}\d{2,4}[A-Z]?)\b/.exec(title);
  return m ? m[1] : null;
}

async function searchPastPapers(query: string): Promise<InternalResult[]> {
  const result = await searchCliPapers(absoluteUrl("/"), {
    query,
    course: null,
    examType: null,
    year: null,
    slot: null,
    semester: null,
    campus: null,
    answerKeysOnly: false,
    includeDrafts: false,
    page: 1,
    limit: PER_TYPE_SEARCH_LIMIT,
  });

  return result.papers.map((paper) => {
    const qualifiers = [
      paper.course?.code,
      paper.examTypeLabel,
      paper.year,
      paper.hasAnswerKey ? "answer key" : null,
    ].filter(Boolean);

    return {
      id: toResourceId({ kind: "past_paper", id: paper.id }),
      title: `Past paper: ${stripPdfExtension(paper.title)}${
        qualifiers.length ? ` (${qualifiers.join(", ")})` : ""
      }`,
      url: paper.pageUrl,
      _courseCode: paper.course?.code ?? null,
      _kindRank: KIND_RANK.past_paper,
    };
  });
}

async function searchNotes(query: string): Promise<InternalResult[]> {
  const notes = await getNotesPage({
    search: query,
    tags: [],
    page: 1,
    pageSize: PER_TYPE_SEARCH_LIMIT,
  });

  return notes.map((note) => ({
    id: toResourceId({ kind: "note", id: note.id }),
    title: `Note: ${stripPdfExtension(note.title)}`,
    url: absoluteUrl(`/notes/${encodeURIComponent(note.id)}`),
    _courseCode: inferCourseCodeFromTitle(note.title),
    _kindRank: KIND_RANK.note,
  }));
}

async function searchSyllabi(query: string): Promise<InternalResult[]> {
  const syllabi = await getSyllabusPage({
    search: query,
    page: 1,
    pageSize: PER_TYPE_SEARCH_LIMIT,
  });

  return syllabi.map((syllabus) => {
    const parsed = parseSyllabusName(syllabus.name);
    const name = parsed.courseName ?? formatSyllabusDisplayName(syllabus.name);

    return {
      id: toResourceId({ kind: "syllabus", id: syllabus.id }),
      title: `Syllabus: ${name}${parsed.courseCode ? ` (${parsed.courseCode})` : ""}`,
      url: absoluteUrl(`/syllabus/${encodeURIComponent(syllabus.id)}`),
      _courseCode: parsed.courseCode ?? null,
      _kindRank: KIND_RANK.syllabus,
    };
  });
}

function searchVinResources(query: string): InternalResult[] {
  return getVinCourses({ search: query })
    .slice(0, PER_TYPE_SEARCH_LIMIT)
    .map((course) => ({
      id: toResourceId({ kind: "resource", id: course.slug }),
      title: `Resource: ${course.displayName}`,
      url: absoluteUrl(`/resources/${encodeURIComponent(course.slug)}`),
      _courseCode: null,
      _kindRank: KIND_RANK.resource,
    }));
}

const searchProviders: SearchProvider[] = [
  searchCourses,
  searchPastPapers,
  searchNotes,
  searchSyllabi,
  searchVinResources,
];

export async function searchExamCookerResources(
  query: string,
): Promise<McpSearchOutput> {
  const trimmedQuery = query.trim();
  const providerResults = await Promise.all(
    searchProviders.map((provider) => provider(trimmedQuery)),
  );
  const all = providerResults.flat();

  // Build paperCount rank from the course results so we can group everything
  // by course and pull the most-active courses (most papers) to the top.
  const coursePaperRank = new Map<string, number>();
  // Match the same course ranking as searchCourses(): full catalog rank by
  // paperCount, not just the top 5 we surface as tiles.
  const allCourses = await searchCourseGrid(trimmedQuery);
  for (const c of allCourses) coursePaperRank.set(c.code, c.paperCount);

  return {
    results: dedupeAndSort(all, coursePaperRank),
  };
}

function moduleLinks(module: {
  webReferences: string[] | null;
  youtubeLinks: string[] | null;
}) {
  return [
    ...(module.webReferences ?? []).map((url) => `reference: ${url}`),
    ...(module.youtubeLinks ?? []).map((url) => `video: ${url}`),
  ];
}

function formatVinCourse(course: VinCourse): McpFetchOutput {
  const topicSections = course.modules.flatMap((module) =>
    module.subtopics.map((topic) => {
      const resources = [
        ...topic.videos.map((url) => `video: ${url}`),
        ...topic.exampleVideos.map((url) => `example video: ${url}`),
        topic.pdfLink ? `pdf: ${topic.pdfLink}` : null,
        ...topic.takeaways.flatMap((item) =>
          item.text ? [`takeaway: ${item.text}`] : [],
        ),
        ...topic.questions.flatMap((item) =>
          item.text ? [`previous question: ${item.text}`] : [],
        ),
      ].filter((item): item is string => item !== null);

      return [
        `### ${module.title}: ${topic.title}`,
        listItems(resources),
      ].join("\n");
    }),
  );

  return {
    id: toResourceId({ kind: "resource", id: course.slug }),
    title: `${course.displayName} resources`,
    url: absoluteUrl(`/resources/${encodeURIComponent(course.slug)}`),
    text: joinSections([
      `# ${course.displayName} resources`,
      course.shortName ? `Short name: ${course.shortName}` : null,
      `Year: ${course.year}`,
      `Modules: ${course.counts.moduleCount}`,
      `Topics: ${course.counts.topicCount}`,
      ...topicSections,
    ]),
    metadata: compactMetadata({
      type: "resource",
      source: "VInTogether",
      moduleCount: course.counts.moduleCount,
      topicCount: course.counts.topicCount,
      videoCount: course.counts.videoCount,
      questionCount: course.counts.questionCount,
    }),
  };
}

async function fetchCourse(ref: ResourceRef) {
  const courseCode = normalizeCourseCode(ref.id);
  if (!courseCode) return null;

  const [courseDetail, subjectDetail, syllabus] = await Promise.all([
    getCourseDetailByCode(courseCode),
    getSubjectByCourseCode(courseCode),
    getSyllabusDetailByCourseCode(courseCode),
  ]);

  if (!courseDetail && !subjectDetail && !syllabus) return null;

  const parsedSubject = subjectDetail ? parseSubjectName(subjectDetail.name) : null;
  const canonicalCode = courseDetail?.code ?? parsedSubject?.courseCode ?? courseCode;
  const courseTitle =
    courseDetail?.title ?? parsedSubject?.courseName ?? syllabus?.name ?? canonicalCode;
  const remoteCourse = findVinCourseByNames([
    canonicalCode,
    courseTitle,
    ...(courseDetail?.aliases ?? []),
  ]);

  const [papers, notes] = await Promise.all([
    searchCliPapers(absoluteUrl("/"), {
      query: null,
      course: canonicalCode,
      examType: null,
      year: null,
      slot: null,
      semester: null,
      campus: null,
      answerKeysOnly: false,
      includeDrafts: false,
      page: 1,
      limit: COURSE_DETAIL_LIMIT,
    }),
    getCourseNotesPage({
      courseId: courseDetail?.id,
      page: 1,
      pageSize: COURSE_DETAIL_LIMIT,
    }),
  ]);

  const moduleSummaries =
    subjectDetail?.modules.map((module) => {
      const links = moduleLinks(module);
      return `${module.title}${links.length ? ` (${links.join(", ")})` : ""}`;
    }) ?? [];

  return {
    id: toResourceId({ kind: "course", id: canonicalCode }),
    title: `${canonicalCode} - ${courseTitle}`,
    url: absoluteUrl(getCoursePastPapersPath(canonicalCode)),
    text: joinSections([
      `# ${canonicalCode} - ${courseTitle}`,
      `Past papers: ${courseDetail?.paperCount ?? papers.total}`,
      `Notes: ${courseDetail?.noteCount ?? notes.length}`,
      syllabus
        ? [
            `Syllabus: ${formatSyllabusDisplayName(syllabus.name)}`,
            `Syllabus URL: ${absoluteUrl(getCourseSyllabusPath(canonicalCode))}`,
            `PDF: ${syllabus.fileUrl}`,
          ].join("\n")
        : "Syllabus: not listed",
      `Past papers URL: ${absoluteUrl(getCoursePastPapersPath(canonicalCode))}`,
      `Notes URL: ${absoluteUrl(getCourseNotesPath(canonicalCode))}`,
      `Resources URL: ${absoluteUrl(getCourseResourcesPath(canonicalCode))}`,
      "## Recent past papers",
      listItems(
        papers.papers.map((paper) => {
          const qualifiers = [
            paper.examTypeLabel,
            paper.year,
            paper.slot ? `slot ${paper.slot}` : null,
            paper.hasAnswerKey ? "answer key" : null,
          ].filter(Boolean);
          return `${stripPdfExtension(paper.title)}${
            qualifiers.length ? ` (${qualifiers.join(", ")})` : ""
          } - ${paper.pageUrl}`;
        }),
      ),
      "## Recent notes",
      listItems(
        notes.map(
          (note) =>
            `${stripPdfExtension(note.title)} - ${absoluteUrl(
              `/notes/${encodeURIComponent(note.id)}`,
            )}`,
        ),
      ),
      subjectDetail ? "## Module resources" : null,
      subjectDetail ? listItems(moduleSummaries) : null,
      remoteCourse
        ? [
            `VInTogether resources: ${remoteCourse.counts.moduleCount} modules, ${remoteCourse.counts.topicCount} topics, ${remoteCourse.counts.videoCount} videos, ${remoteCourse.counts.questionCount} previous questions.`,
            `Resource URL: ${absoluteUrl(`/resources/${encodeURIComponent(remoteCourse.slug)}`)}`,
          ].join("\n")
        : null,
    ]),
    metadata: compactMetadata({
      type: "course",
      courseCode: canonicalCode,
      paperCount: courseDetail?.paperCount ?? papers.total,
      noteCount: courseDetail?.noteCount ?? notes.length,
      hasSyllabus: Boolean(syllabus),
      hasModuleResources: Boolean(subjectDetail || remoteCourse),
    }),
  };
}

async function fetchPastPaper(ref: ResourceRef) {
  const paper = await getCliPastPaperDetail(absoluteUrl("/"), ref.id);
  if (!paper || !paper.isClear) return null;

  return {
    id: toResourceId({ kind: "past_paper", id: paper.id }),
    title: stripPdfExtension(paper.title),
    url: paper.pageUrl,
    text: joinSections([
      `# ${stripPdfExtension(paper.title)}`,
      [
        paper.course?.code ? `Course: ${paper.course.code}` : null,
        paper.course?.title ? `Course title: ${paper.course.title}` : null,
        paper.examTypeLabel ? `Exam type: ${paper.examTypeLabel}` : null,
        paper.year ? `Year: ${paper.year}` : null,
        paper.slot ? `Slot: ${paper.slot}` : null,
        `Semester: ${paper.semester}`,
        `Campus: ${paper.campus}`,
        `Answer key: ${paper.hasAnswerKey ? "yes" : "no"}`,
        `PDF: ${normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
      paper.tags.length ? "## Tags" : null,
      paper.tags.length ? listItems(paper.tags.map((tag) => tag.name)) : null,
      paper.siblingPaper ? "## Related paper" : null,
      paper.siblingPaper
        ? `${stripPdfExtension(paper.siblingPaper.title)} - ${paper.siblingPaper.pageUrl}`
        : null,
    ]),
    metadata: compactMetadata({
      type: "past_paper",
      courseCode: paper.course?.code ?? null,
      examType: paper.examType,
      year: paper.year,
      hasAnswerKey: paper.hasAnswerKey,
      fileUrl: normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl,
    }),
  };
}

async function fetchNote(ref: ResourceRef) {
  const note = await getNoteDetail(ref.id);
  if (!note || !note.isClear) return null;

  return {
    id: toResourceId({ kind: "note", id: note.id }),
    title: stripPdfExtension(note.title),
    url: absoluteUrl(`/notes/${encodeURIComponent(note.id)}`),
    text: joinSections([
      `# ${stripPdfExtension(note.title)}`,
      note.course
        ? `Course: ${note.course.code} - ${note.course.title}`
        : "Course: not listed",
      `PDF: ${note.fileUrl}`,
      note.tags.length ? "## Tags" : null,
      note.tags.length ? listItems(note.tags.map((tag) => tag.name)) : null,
    ]),
    metadata: compactMetadata({
      type: "note",
      courseCode: note.course?.code ?? null,
      fileUrl: note.fileUrl,
      thumbnailUrl: note.thumbNailUrl,
    }),
  };
}

async function fetchSyllabus(ref: ResourceRef) {
  const syllabus = await getSyllabusDetail(ref.id);
  if (!syllabus) return null;

  const parsed = parseSyllabusName(syllabus.name);
  const title =
    parsed.courseCode && parsed.courseName
      ? `${parsed.courseCode} - ${parsed.courseName} syllabus`
      : `${formatSyllabusDisplayName(syllabus.name)} syllabus`;

  return {
    id: toResourceId({ kind: "syllabus", id: syllabus.id }),
    title,
    url: parsed.courseCode
      ? absoluteUrl(getCourseSyllabusPath(parsed.courseCode))
      : absoluteUrl(`/syllabus/${encodeURIComponent(syllabus.id)}`),
    text: joinSections([
      `# ${title}`,
      parsed.courseCode ? `Course code: ${parsed.courseCode}` : null,
      parsed.courseName ? `Course title: ${parsed.courseName}` : null,
      `PDF: ${syllabus.fileUrl}`,
    ]),
    metadata: compactMetadata({
      type: "syllabus",
      courseCode: parsed.courseCode,
      fileUrl: syllabus.fileUrl,
    }),
  };
}

async function fetchResource(ref: ResourceRef) {
  const remoteCourse = getVinCourseById(ref.id);
  if (remoteCourse) return formatVinCourse(remoteCourse);

  const subject = await getSubjectDetail(ref.id);
  if (!subject) return null;

  const parsed = parseSubjectName(subject.name);
  const title = `${parsed.courseName} resources`;
  const moduleSections = subject.modules.map((module) =>
    [`### ${module.title}`, listItems(moduleLinks(module))].join("\n"),
  );

  return {
    id: toResourceId({ kind: "resource", id: subject.id }),
    title,
    url: absoluteUrl(`/resources/${encodeURIComponent(subject.id)}`),
    text: joinSections([
      `# ${title}`,
      parsed.courseCode ? `Course code: ${parsed.courseCode}` : null,
      `Modules: ${subject.modules.length}`,
      ...moduleSections,
    ]),
    metadata: compactMetadata({
      type: "resource",
      courseCode: parsed.courseCode,
      moduleCount: subject.modules.length,
    }),
  };
}

const fetchProviders: Record<ResourceRef["kind"], FetchProvider> = {
  course: fetchCourse,
  note: fetchNote,
  past_paper: fetchPastPaper,
  syllabus: fetchSyllabus,
  resource: fetchResource,
};

export async function fetchExamCookerResource(
  rawId: string,
): Promise<McpFetchOutput | null> {
  const ref = parseResourceRef(rawId);
  if (!ref) return null;

  return fetchProviders[ref.kind](ref);
}
