import { and, count, eq, ilike, or, desc } from "drizzle-orm";
import type { Campus, ExamType, Semester } from "@/db";
import { course, db, pastPaper } from "@/db";
import { normalizeCourseCode } from "@/lib/course-tags";
import { getSiblingPastPaper, getPastPaperDetail } from "@/lib/data/past-paper-detail";
import { examTypeLabel } from "@/lib/exam-slug";
import { getPastPaperDetailPath } from "@/lib/seo";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CliPaperSearchFilters = {
  query?: string | null;
  course?: string | null;
  examType?: ExamType | null;
  year?: number | null;
  slot?: string | null;
  semester?: Semester | null;
  campus?: Campus | null;
  answerKeysOnly?: boolean;
  includeDrafts?: boolean;
  page: number;
  limit: number;
};

function buildPageUrl(baseUrl: string, paperId: string, courseCode?: string | null) {
  return `${baseUrl.replace(/\/$/, "")}${getPastPaperDetailPath(paperId, courseCode)}`;
}

export async function searchCliPapers(
  baseUrl: string,
  input: CliPaperSearchFilters,
) {
  const clauses = [];
  const trimmedQuery = input.query?.trim();
  const normalizedCourse = input.course?.trim();

  if (!input.includeDrafts) {
    clauses.push(eq(pastPaper.isClear, true));
  }

  if (trimmedQuery) {
    const pattern = `%${trimmedQuery}%`;
    clauses.push(
      or(
        ilike(pastPaper.title, pattern),
        ilike(course.code, pattern),
        ilike(course.title, pattern),
      ),
    );
  }

  if (normalizedCourse) {
    if (UUID_PATTERN.test(normalizedCourse)) {
      clauses.push(
        or(
          eq(pastPaper.courseId, normalizedCourse),
          eq(course.code, normalizeCourseCode(normalizedCourse)),
        ),
      );
    } else {
      clauses.push(eq(course.code, normalizeCourseCode(normalizedCourse)));
    }
  }

  if (input.examType) {
    clauses.push(eq(pastPaper.examType, input.examType));
  }
  if (input.year !== null && input.year !== undefined) {
    clauses.push(eq(pastPaper.year, input.year));
  }
  if (input.slot) {
    clauses.push(eq(pastPaper.slot, input.slot));
  }
  if (input.semester) {
    clauses.push(eq(pastPaper.semester, input.semester));
  }
  if (input.campus) {
    clauses.push(eq(pastPaper.campus, input.campus));
  }
  if (input.answerKeysOnly) {
    clauses.push(eq(pastPaper.hasAnswerKey, true));
  }

  const where = clauses.length > 0 ? and(...clauses) : undefined;
  const offset = Math.max(0, (input.page - 1) * input.limit);

  const [totalRows, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(pastPaper)
      .leftJoin(course, eq(pastPaper.courseId, course.id))
      .where(where),
    db
      .select({
        id: pastPaper.id,
        title: pastPaper.title,
        fileUrl: pastPaper.fileUrl,
        isClear: pastPaper.isClear,
        examType: pastPaper.examType,
        slot: pastPaper.slot,
        year: pastPaper.year,
        semester: pastPaper.semester,
        campus: pastPaper.campus,
        hasAnswerKey: pastPaper.hasAnswerKey,
        questionPaperId: pastPaper.questionPaperId,
        createdAt: pastPaper.createdAt,
        courseCode: course.code,
        courseTitle: course.title,
      })
      .from(pastPaper)
      .leftJoin(course, eq(pastPaper.courseId, course.id))
      .where(where)
      .orderBy(desc(pastPaper.createdAt))
      .offset(offset)
      .limit(input.limit),
  ]);

  const papers = rows.map((row) => ({
    id: row.id,
    title: row.title,
    fileUrl: row.fileUrl,
    pageUrl: buildPageUrl(baseUrl, row.id, row.courseCode),
    isClear: row.isClear,
    examType: row.examType,
    examTypeLabel: row.examType ? examTypeLabel(row.examType) : null,
    slot: row.slot,
    year: row.year,
    semester: row.semester,
    campus: row.campus,
    hasAnswerKey: row.hasAnswerKey,
    questionPaperId: row.questionPaperId,
    createdAt: row.createdAt.toISOString(),
    course: row.courseCode
      ? {
          code: row.courseCode,
          title: row.courseTitle,
        }
      : null,
  }));

  const total = totalRows[0]?.total ?? 0;

  return {
    total,
    page: input.page,
    limit: input.limit,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
    hasNextPage: input.page * input.limit < total,
    papers,
  };
}

export async function getCliPastPaperDetail(baseUrl: string, paperId: string) {
  const paper = await getPastPaperDetail(paperId);
  if (!paper) {
    return null;
  }

  const siblingPaper = await getSiblingPastPaper({
    paperId: paper.id,
    questionPaperId: paper.questionPaperId,
    courseId: paper.courseId,
    examType: paper.examType,
    slot: paper.slot,
    year: paper.year,
    semester: paper.semester,
    campus: paper.campus,
    hasAnswerKey: paper.hasAnswerKey,
  });

  return {
    id: paper.id,
    title: paper.title,
    fileUrl: paper.fileUrl,
    pageUrl: buildPageUrl(baseUrl, paper.id, paper.course?.code),
    isClear: paper.isClear,
    examType: paper.examType,
    examTypeLabel: paper.examType ? examTypeLabel(paper.examType) : null,
    slot: paper.slot,
    year: paper.year,
    semester: paper.semester,
    campus: paper.campus,
    hasAnswerKey: paper.hasAnswerKey,
    questionPaperId: paper.questionPaperId,
    createdAt: paper.createdAt.toISOString(),
    updatedAt: paper.updatedAt.toISOString(),
    course: paper.course,
    author: paper.author,
    tags: paper.tags,
    siblingPaper: siblingPaper
      ? {
          ...siblingPaper,
          pageUrl: buildPageUrl(baseUrl, siblingPaper.id, siblingPaper.course?.code),
          examTypeLabel: siblingPaper.examType
            ? examTypeLabel(siblingPaper.examType)
            : null,
        }
      : null,
  };
}
