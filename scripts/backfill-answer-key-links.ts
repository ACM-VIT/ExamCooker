import "dotenv/config";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { createScriptDb } from "./lib/db";
import { course, pastPaper } from "../db";

type CandidatePaper = {
  id: string;
  title: string;
  hasAnswerKey: boolean;
  questionPaperId: string | null;
  courseId: string | null;
  examType: string | null;
  slot: string | null;
  year: number | null;
  semester: string;
  campus: string;
  createdAt: Date;
  course: {
    code: string;
    title: string;
  } | null;
};

type PlannedLink = {
  answerKeyPaperId: string;
  answerKeyTitle: string;
  previousQuestionPaperId: string | null;
  questionPaperId: string;
  questionPaperTitle: string;
  courseCode: string;
  examType: string;
  slot: string;
  year: number;
  semester: string;
  campus: string;
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const courseCodesArg = [...args].find((arg) => arg.startsWith("--course-codes="));
const courseCodes = new Set(
  (courseCodesArg?.split("=")[1] ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean),
);

function strictGroupKey(paper: CandidatePaper) {
  return [
    paper.courseId,
    paper.examType,
    paper.slot,
    paper.year,
    paper.semester,
    paper.campus,
  ].join("::");
}

function compareByCreatedAt(left: CandidatePaper, right: CandidatePaper) {
  return (
    left.createdAt.getTime() - right.createdAt.getTime() ||
    left.id.localeCompare(right.id)
  );
}

async function main() {
  const { db, close } = createScriptDb();

  try {
    const rows = await db
      .select({
        id: pastPaper.id,
        title: pastPaper.title,
        hasAnswerKey: pastPaper.hasAnswerKey,
        questionPaperId: pastPaper.questionPaperId,
        courseId: pastPaper.courseId,
        examType: pastPaper.examType,
        slot: pastPaper.slot,
        year: pastPaper.year,
        semester: pastPaper.semester,
        campus: pastPaper.campus,
        createdAt: pastPaper.createdAt,
        course: {
          code: course.code,
          title: course.title,
        },
      })
      .from(pastPaper)
      .leftJoin(course, eq(pastPaper.courseId, course.id))
      .where(
        and(
          eq(pastPaper.isClear, true),
          isNull(pastPaper.moderationArchivedAt),
          isNotNull(pastPaper.courseId),
          isNotNull(pastPaper.examType),
          isNotNull(pastPaper.slot),
          isNotNull(pastPaper.year),
        ),
      );

    const papers: CandidatePaper[] = rows.map((row) => ({
      ...row,
      course: row.course?.code ? row.course : null,
    }));

    const filteredPapers =
      courseCodes.size === 0
        ? papers
        : papers.filter(
            (paper) =>
              paper.course?.code &&
              courseCodes.has(paper.course.code.toUpperCase()),
          );

    const groups = new Map<string, CandidatePaper[]>();
    for (const paper of filteredPapers) {
      const key = strictGroupKey(paper);
      const existing = groups.get(key);
      if (existing) {
        existing.push(paper);
      } else {
        groups.set(key, [paper]);
      }
    }

    const plannedLinks: PlannedLink[] = [];
    for (const papersInGroup of groups.values()) {
      const questionPapers = papersInGroup
        .filter((paper) => !paper.hasAnswerKey)
        .sort(compareByCreatedAt);
      const answerKeys = papersInGroup
        .filter((paper) => paper.hasAnswerKey)
        .sort(compareByCreatedAt);

      if (questionPapers.length !== 1 || answerKeys.length !== 1) {
        continue;
      }

      const [questionPaper] = questionPapers;
      const [answerKey] = answerKeys;
      if (!questionPaper || !answerKey) {
        continue;
      }
      if (
        !questionPaper.course?.code ||
        !questionPaper.examType ||
        !questionPaper.slot ||
        questionPaper.year === null
      ) {
        continue;
      }
      if (answerKey.questionPaperId === questionPaper.id) {
        continue;
      }

      plannedLinks.push({
        answerKeyPaperId: answerKey.id,
        answerKeyTitle: answerKey.title,
        previousQuestionPaperId: answerKey.questionPaperId,
        questionPaperId: questionPaper.id,
        questionPaperTitle: questionPaper.title,
        courseCode: questionPaper.course.code,
        examType: questionPaper.examType,
        slot: questionPaper.slot,
        year: questionPaper.year,
        semester: questionPaper.semester,
        campus: questionPaper.campus,
      });
    }

    const affectedCourses = [
      ...new Set(plannedLinks.map((link) => link.courseCode)),
    ].sort();

    console.log(
      JSON.stringify(
        {
          dryRun,
          plannedLinks: plannedLinks.length,
          affectedCourses: affectedCourses.length,
          sampleCourseCodes: affectedCourses.slice(0, 40),
          sampleLinks: plannedLinks.slice(0, 10),
        },
        null,
        2,
      ),
    );

    if (dryRun || plannedLinks.length === 0) {
      return;
    }

    // Papers can be edited, archived or linked between planning and writing.
    // Each write applies only if both papers are still in the planned state;
    // otherwise it is skipped rather than linking an answer key to a paper
    // that is no longer a published question paper.
    let linked = 0;
    await db.transaction(async (tx) => {
      for (const link of plannedLinks) {
        const updated = await tx
          .update(pastPaper)
          .set({
            questionPaperId: link.questionPaperId,
          })
          .where(
            and(
              eq(pastPaper.id, link.answerKeyPaperId),
              eq(pastPaper.isClear, true),
              eq(pastPaper.hasAnswerKey, true),
              isNull(pastPaper.moderationArchivedAt),
              link.previousQuestionPaperId === null
                ? isNull(pastPaper.questionPaperId)
                : eq(pastPaper.questionPaperId, link.previousQuestionPaperId),
              sql`exists (
                select 1 from "PastPaper" question_paper
                where question_paper."id" = ${link.questionPaperId}
                  and question_paper."isClear" = true
                  and question_paper."hasAnswerKey" = false
                  and question_paper."moderationArchivedAt" is null
              )`,
              sql`not exists (
                select 1 from "PastPaper" linked_paper
                where linked_paper."questionPaperId" = ${link.questionPaperId}
                  and linked_paper."id" <> ${link.answerKeyPaperId}
              )`,
            ),
          )
          .returning({ id: pastPaper.id });
        linked += updated.length;
      }
    });

    console.log(
      `Linked ${linked} answer-key row(s); skipped ${
        plannedLinks.length - linked
      } that changed since planning.`,
    );
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
