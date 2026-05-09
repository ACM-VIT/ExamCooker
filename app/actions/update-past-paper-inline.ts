"use server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/app/auth";
import { revalidateTag } from "next/cache";
import { db, pastPaper, pastPaperToTag } from "@/db";
import { invalidatePastPapersSurfaceCache } from "@/lib/cache/past-papers-surface-cache";
import { campusValues, examTypeValues, semesterValues } from "@/db/enums";
import { findOrCreateTag } from "@/db/helpers";

const schema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(240),
  courseId: z.string().min(1).nullable(),
  examType: z.enum(examTypeValues).nullable(),
  slot: z
    .string()
    .regex(/^[A-G][12]$/i, "Slot must match A1..G2")
    .transform((value) => value.toUpperCase())
    .nullable()
    .or(z.literal("").transform(() => null)),
  year: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .nullable()
    .or(z.nan().transform(() => null)),
  semester: z.enum(semesterValues),
  campus: z.enum(campusValues),
  hasAnswerKey: z.boolean(),
  questionPaperId: z.string().min(1).nullable(),
  tags: z.array(z.string()).max(50),
});

function normalizeTags(tags: string[]) {
  const map = new Map<string, string>();

  for (const tagName of tags) {
    const cleaned = tagName.trim().replace(/\s+/g, " ");
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (!map.has(key)) {
      map.set(key, cleaned);
    }
  }

  return Array.from(map.values());
}

export async function updatePastPaperInline(input: z.input<typeof schema>) {
  const session = await auth();
  if (session?.user?.role !== "MODERATOR") {
    throw new Error("Access denied");
  }

  const parsed = schema.parse(input);
  const [existingPaper] = await db
    .select({
      id: pastPaper.id,
      questionPaperId: pastPaper.questionPaperId,
    })
    .from(pastPaper)
    .where(eq(pastPaper.id, parsed.id))
    .limit(1);

  if (!existingPaper) {
    throw new Error("Past paper not found.");
  }

  let questionPaperId: string | null = null;

  if (parsed.hasAnswerKey) {
    if (!parsed.questionPaperId) {
      throw new Error("Answer keys must be linked to a question paper.");
    }

    if (parsed.questionPaperId === parsed.id) {
      throw new Error("A paper cannot be linked to itself.");
    }

    const [questionPaper] = await db
      .select({
        id: pastPaper.id,
        title: pastPaper.title,
        courseId: pastPaper.courseId,
        hasAnswerKey: pastPaper.hasAnswerKey,
      })
      .from(pastPaper)
      .where(eq(pastPaper.id, parsed.questionPaperId))
      .limit(1);

    if (!questionPaper) {
      throw new Error("Question paper not found.");
    }

    if (questionPaper.hasAnswerKey) {
      throw new Error("Question paper cannot itself be marked as an answer key.");
    }

    if (
      parsed.courseId !== null &&
      questionPaper.courseId !== null &&
      parsed.courseId !== questionPaper.courseId
    ) {
      throw new Error("Answer key and question paper must belong to the same course.");
    }

    const [conflictingLink] = await db
      .select({
        id: pastPaper.id,
        title: pastPaper.title,
      })
      .from(pastPaper)
      .where(
        and(
          eq(pastPaper.questionPaperId, parsed.questionPaperId),
          ne(pastPaper.id, parsed.id),
        ),
      )
      .limit(1);

    if (conflictingLink) {
      throw new Error(
        `Question paper already has an answer key linked: ${conflictingLink.title}`,
      );
    }

    const [linkedAnswerKey] = await db
      .select({
        id: pastPaper.id,
        title: pastPaper.title,
      })
      .from(pastPaper)
      .where(
        and(
          eq(pastPaper.questionPaperId, parsed.id),
          ne(pastPaper.id, parsed.id),
        ),
      )
      .limit(1);

    if (linkedAnswerKey) {
      throw new Error(
        `This paper already has an answer key linked: ${linkedAnswerKey.title}`,
      );
    }

    questionPaperId = questionPaper.id;
  }

  const tagNames = normalizeTags(parsed.tags);
  const tagRecords = await Promise.all(
    tagNames.map((tagName) =>
      findOrCreateTag(tagName, { caseInsensitive: true }),
    ),
  );

  await db.transaction(async (tx) => {
    await tx
      .update(pastPaper)
      .set({
        title: parsed.title,
        courseId: parsed.courseId,
        examType: parsed.examType,
        slot: parsed.slot,
        year: parsed.year,
        semester: parsed.semester,
        campus: parsed.campus,
        hasAnswerKey: parsed.hasAnswerKey,
        questionPaperId,
      })
      .where(eq(pastPaper.id, parsed.id));

    await tx.delete(pastPaperToTag).where(eq(pastPaperToTag.a, parsed.id));
    if (tagRecords.length > 0) {
      await tx.insert(pastPaperToTag).values(
        tagRecords.map((tagRecord) => ({
          a: parsed.id,
          b: tagRecord.id,
        })),
      );
    }
  });

  revalidateTag("past_papers", "minutes");
  revalidateTag(`past_paper:${parsed.id}`, "minutes");
  revalidateTag("courses", "minutes");

  if (existingPaper.questionPaperId) {
    revalidateTag(`past_paper:${existingPaper.questionPaperId}`, "minutes");
  }

  if (questionPaperId && questionPaperId !== existingPaper.questionPaperId) {
    revalidateTag(`past_paper:${questionPaperId}`, "minutes");
  }

  await invalidatePastPapersSurfaceCache();

  return { success: true };
}
