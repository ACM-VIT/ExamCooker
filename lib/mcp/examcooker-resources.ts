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

export type McpAsset = {
  uri: string;
  name: string;
  mimeType: string;
  description?: string;
};

export type McpFetchOutput = {
  id: string;
  title: string;
  text: string;
  url: string;
  pdfUrl?: string;
  imageUrls?: string[];
  assets?: McpAsset[];
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

function mediaTypeForUrl(url: string) {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();

  if (path.endsWith(".pdf")) return "application/pdf";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function toPublicAssetUrl(url: string | null | undefined) {
  return normalizeGcsUrl(url);
}

function buildAssets(
  entries: Array<{
    url: string | null | undefined;
    name: string;
    description?: string;
  }>,
) {
  const seen = new Set<string>();
  return entries.flatMap(({ url, name, description }) => {
    const normalizedUrl = toPublicAssetUrl(url)?.trim();
    if (!normalizedUrl || seen.has(normalizedUrl)) return [];
    seen.add(normalizedUrl);
    return [
      {
        uri: normalizedUrl,
        name,
        mimeType: mediaTypeForUrl(normalizedUrl),
        ...(description ? { description } : {}),
      },
    ];
  });
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

function inferCourseCodeFromTitle(title: string): string | null {
  const match = /\b([A-Z]{2,5}\d{2,4}[A-Z]?)\b/.exec(title);
  return match?.[1] ?? null;
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
  const allCourses = await searchCourseGrid(trimmedQuery);
  const coursePaperRank = new Map(allCourses.map((course) => [course.code, course.paperCount]));

  return {
    results: dedupeAndSort(providerResults.flat(), coursePaperRank),
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

function getVinCourseAssets(course: VinCourse) {
  return buildAssets([
    ...(course.image ? [{ url: course.image, name: `${course.displayName} cover image` }] : []),
    ...course.modules.flatMap((module) =>
      module.subtopics.flatMap((topic) => [
        ...(topic.pdfLink ? [{ url: topic.pdfLink, name: `${topic.title} PDF` }] : []),
        ...topic.takeaways.flatMap((item) =>
          item.image ? [{ url: item.image, name: `${topic.title} takeaway` }] : [],
        ),
        ...topic.questions.flatMap((item) =>
          item.image ? [{ url: item.image, name: `${topic.title} question` }] : [],
        ),
      ]),
    ),
  ]);
}

function formatVinCourse(course: VinCourse): McpFetchOutput {
  const topicSections = course.modules.flatMap((module) =>
    module.subtopics.map((topic) => {
      const resources = [
        ...topic.videos.map((url) => `video: ${url}`),
        ...topic.exampleVideos.map((url) => `example video: ${url}`),
        topic.pdfLink ? `pdf: ${topic.pdfLink}` : null,
        ...topic.takeaways
          .map((item) => (item.text ? `takeaway: ${item.text}` : null))
          .filter((item): item is string => item !== null),
        ...topic.questions
          .map((item) => (item.text ? `previous question: ${item.text}` : null))
          .filter((item): item is string => item !== null),
      ].filter((item): item is string => item !== null);

      return [`### ${module.title}: ${topic.title}`, listItems(resources)].join("\n");
    }),
  );

  const assets = getVinCourseAssets(course);

  const path = `/resources/${encodeURIComponent(course.slug)}`;
  return {
    id: toResourceId({ kind: "resource", id: course.slug }),
    title: `${course.displayName} resources`,
    url: absoluteUrl(path),
    imageUrls: assets
      .filter((asset) => asset.mimeType.startsWith("image/"))
      .map((asset) => asset.uri),
    assets,
    text: joinSections([
      `# ${course.displayName} resources`,
      `Year: ${course.year}`,
      `Modules: ${course.counts.moduleCount}`,
      `Topics: ${course.counts.topicCount}`,
      `Videos: ${course.counts.videoCount + course.counts.exampleVideoCount}`,
      `Previous questions: ${course.counts.questionCount}`,
      ...topicSections,
    ]),
    metadata: compactMetadata({
      type: "resource",
      year: course.year,
      moduleCount: course.counts.moduleCount,
      topicCount: course.counts.topicCount,
      videoCount: course.counts.videoCount,
      questionCount: course.counts.questionCount,
      assetCount: assets.length,
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
  const parsedSubject = subjectDetail ? parseSubjectName(subjectDetail.name) : null;
  const remoteCourse = findVinCourseByNames([
    courseCode,
    courseDetail?.title,
    ...(courseDetail?.aliases ?? []),
    parsedSubject?.courseName,
  ]);

  if (!courseDetail && !subjectDetail && !syllabus && !remoteCourse) return null;

  const canonicalCode = courseDetail?.code ?? parsedSubject?.courseCode ?? courseCode;
  const courseTitle =
    courseDetail?.title ?? parsedSubject?.courseName ?? syllabus?.name ?? remoteCourse?.displayName ?? canonicalCode;

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

  const remoteAssets = remoteCourse ? getVinCourseAssets(remoteCourse) : [];
  const assets = buildAssets([
    ...(syllabus
      ? [{ url: syllabus.fileUrl, name: `${canonicalCode} syllabus PDF` }]
      : []),
    ...papers.papers.map((paper) => ({
      url: paper.fileUrl,
      name: `${stripPdfExtension(paper.title)} PDF`,
    })),
    ...notes.map((note) => ({
      url: note.fileUrl,
      name: `${stripPdfExtension(note.title)} PDF`,
    })),
    ...(subjectDetail?.modules.flatMap((module) =>
      (module.webReferences ?? []).map((url) => ({
        url,
        name: `${module.title} resource`,
      })),
    ) ?? []),
    ...remoteAssets.map((asset) => ({
      url: asset.uri,
      name: asset.name,
      description: asset.description,
    })),
  ]);

  return {
    id: toResourceId({ kind: "course", id: canonicalCode }),
    title: `${canonicalCode} - ${courseTitle}`,
    url: absoluteUrl(getCoursePastPapersPath(canonicalCode)),
    imageUrls: assets
      .filter((asset) => asset.mimeType.startsWith("image/"))
      .map((asset) => asset.uri),
    assets,
    text: joinSections([
      `# ${canonicalCode} - ${courseTitle}`,
      `Past papers: ${courseDetail?.paperCount ?? papers.total}`,
      `Notes: ${courseDetail?.noteCount ?? notes.length}`,
      syllabus
        ? [
            `Syllabus: ${formatSyllabusDisplayName(syllabus.name)}`,
            `Syllabus URL: ${absoluteUrl(getCourseSyllabusPath(canonicalCode))}`,
            `PDF: ${toPublicAssetUrl(syllabus.fileUrl)}`,
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
            `Module resources: ${remoteCourse.counts.moduleCount} modules, ${remoteCourse.counts.topicCount} topics, ${remoteCourse.counts.videoCount} videos, ${remoteCourse.counts.questionCount} previous questions.`,
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
      assetCount: assets.length,
    }),
  };
}

async function fetchPastPaper(ref: ResourceRef) {
  const paper = await getCliPastPaperDetail(absoluteUrl("/"), ref.id);
  if (!paper || !paper.isClear) return null;

  const pdfUrl = toPublicAssetUrl(paper.fileUrl) ?? paper.fileUrl;
  const thumbnailUrl = toPublicAssetUrl(paper.thumbNailUrl);
  const assets = buildAssets([
    {
      url: pdfUrl,
      name: `${stripPdfExtension(paper.title)} PDF`,
      description: "Original ExamCooker past-paper PDF.",
    },
    {
      url: thumbnailUrl,
      name: `${stripPdfExtension(paper.title)} preview`,
      description: "ExamCooker preview image for this past paper.",
    },
  ]);

  return {
    id: toResourceId({ kind: "past_paper", id: paper.id }),
    title: stripPdfExtension(paper.title),
    url: paper.pageUrl,
    pdfUrl,
    imageUrls: assets
      .filter((asset) => asset.mimeType.startsWith("image/"))
      .map((asset) => asset.uri),
    assets,
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
        `PDF: ${pdfUrl}`,
        thumbnailUrl ? `Preview image: ${thumbnailUrl}` : null,
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
      fileUrl: pdfUrl,
      thumbnailUrl,
      assetCount: assets.length,
    }),
  };
}

async function fetchNote(ref: ResourceRef) {
  const note = await getNoteDetail(ref.id);
  if (!note || !note.isClear) return null;

  const pdfUrl = toPublicAssetUrl(note.fileUrl) ?? note.fileUrl;
  const thumbnailUrl = toPublicAssetUrl(note.thumbNailUrl);
  const assets = buildAssets([
    {
      url: pdfUrl,
      name: `${stripPdfExtension(note.title)} PDF`,
      description: "Original ExamCooker note PDF.",
    },
    {
      url: thumbnailUrl,
      name: `${stripPdfExtension(note.title)} preview`,
      description: "ExamCooker preview image for this note.",
    },
  ]);

  return {
    id: toResourceId({ kind: "note", id: note.id }),
    title: stripPdfExtension(note.title),
    url: absoluteUrl(`/notes/${encodeURIComponent(note.id)}`),
    pdfUrl,
    imageUrls: assets
      .filter((asset) => asset.mimeType.startsWith("image/"))
      .map((asset) => asset.uri),
    assets,
    text: joinSections([
      `# ${stripPdfExtension(note.title)}`,
      note.course
        ? `Course: ${note.course.code} - ${note.course.title}`
        : "Course: not listed",
      `PDF: ${pdfUrl}`,
      thumbnailUrl ? `Preview image: ${thumbnailUrl}` : null,
      note.tags.length ? "## Tags" : null,
      note.tags.length ? listItems(note.tags.map((tag) => tag.name)) : null,
    ]),
    metadata: compactMetadata({
      type: "note",
      courseCode: note.course?.code ?? null,
      fileUrl: pdfUrl,
      thumbnailUrl,
      assetCount: assets.length,
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
  const pdfUrl = toPublicAssetUrl(syllabus.fileUrl) ?? syllabus.fileUrl;
  const assets = buildAssets([
    {
      url: pdfUrl,
      name: `${title} PDF`,
      description: "Original ExamCooker syllabus PDF.",
    },
  ]);

  return {
    id: toResourceId({ kind: "syllabus", id: syllabus.id }),
    title,
    url: parsed.courseCode
      ? absoluteUrl(getCourseSyllabusPath(parsed.courseCode))
      : absoluteUrl(`/syllabus/${encodeURIComponent(syllabus.id)}`),
    pdfUrl,
    assets,
    text: joinSections([
      `# ${title}`,
      parsed.courseCode ? `Course code: ${parsed.courseCode}` : null,
      parsed.courseName ? `Course title: ${parsed.courseName}` : null,
      `PDF: ${pdfUrl}`,
    ]),
    metadata: compactMetadata({
      type: "syllabus",
      courseCode: parsed.courseCode,
      fileUrl: pdfUrl,
      assetCount: assets.length,
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
  const path = parsed.courseCode
    ? getCourseResourcesPath(parsed.courseCode)
    : `/resources/${encodeURIComponent(subject.id)}`;
  const assets = buildAssets(
    subject.modules.flatMap((module) =>
      (module.webReferences ?? []).map((url) => ({
        url,
        name: `${module.title} resource`,
      })),
    ),
  );

  return {
    id: toResourceId({ kind: "resource", id: subject.id }),
    title,
    url: absoluteUrl(path),
    imageUrls: assets
      .filter((asset) => asset.mimeType.startsWith("image/"))
      .map((asset) => asset.uri),
    assets,
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
      assetCount: assets.length,
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
