import "dotenv/config";

import { and, eq, isNotNull } from "drizzle-orm";
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
  return [paper.courseId, paper.examType, paper.slot, paper.year].join("::");
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
          isNotNull(pastPaper.courseId),
          isNotNull(pastPaper.examType),
          isNotNull(pastPaper.slot),
          isNotNull(pastPaper.year),
        ),
      );

    const papers: CandidatePaper[] = rows.map((row) => ({
      ...row,
      course: row.course.code ? row.course : null,
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

    await db.transaction(async (tx) => {
      for (const link of plannedLinks) {
        await tx
          .update(pastPaper)
          .set({
            questionPaperId: link.questionPaperId,
          })
          .where(eq(pastPaper.id, link.answerKeyPaperId));
      }
    });

    console.log(`Linked ${plannedLinks.length} answer-key row(s).`);
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
