"use server";

import { and, eq, ilike, ne } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/app/auth";
import { revalidateTag } from "next/cache";
import { course, db, syllabi } from "@/db";

const schema = z.object({
  id: z.string().min(1),
  courseId: z.string().min(1).nullable(),
  title: z.string().trim().max(240).optional().default(""),
}).superRefine((value, context) => {
  if (!value.courseId && !value.title.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Title is required when no course is selected.",
      path: ["title"],
    });
  }
});

function normalizeSyllabusTitle(title: string) {
  return title
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSyllabusName(input: {
  courseCode: string | null;
  title: string;
}) {
  const cleanTitle = normalizeSyllabusTitle(input.title);
  if (!cleanTitle) return null;

  const fileSafeTitle = cleanTitle.replace(/\s+/g, "_");
  if (input.courseCode) {
    return `${input.courseCode}_${fileSafeTitle}.pdf`;
  }

  return `${fileSafeTitle}.pdf`;
}

export async function updateSyllabusInline(input: z.input<typeof schema>) {
  const session = await auth();
  if (session?.user?.role !== "MODERATOR") {
    throw new Error("Access denied");
  }

  const parsed = schema.parse(input);
  const selectedCourse = parsed.courseId
    ? (
        await db
          .select({
            code: course.code,
            title: course.title,
          })
          .from(course)
          .where(eq(course.id, parsed.courseId))
          .limit(1)
      )[0] ?? null
    : null;

  if (parsed.courseId && !selectedCourse) {
    throw new Error("Course not found.");
  }

  const nextTitle = normalizeSyllabusTitle(parsed.title || selectedCourse?.title || "");
  if (!nextTitle) {
    throw new Error("Title is required.");
  }

  const nextName = buildSyllabusName({
    courseCode: selectedCourse?.code ?? null,
    title: nextTitle,
  });
  if (!nextName) {
    throw new Error("Title is required.");
  }

  await db.transaction(async (tx) => {
    if (selectedCourse) {
      const [existingCourseSyllabus] = await tx
        .select({
          id: syllabi.id,
          name: syllabi.name,
        })
        .from(syllabi)
        .where(
          and(
            ilike(syllabi.name, `${selectedCourse.code}_%`),
            ne(syllabi.id, parsed.id),
          ),
        )
        .limit(1);

      if (existingCourseSyllabus) {
        throw new Error(
          `${selectedCourse.code} already has a syllabus linked: ${existingCourseSyllabus.name}`,
        );
      }
    }

    const [updatedSyllabus] = await tx
      .update(syllabi)
      .set({
        name: nextName,
      })
      .where(eq(syllabi.id, parsed.id))
      .returning({ id: syllabi.id });

    if (!updatedSyllabus) {
      throw new Error("Syllabus not found.");
    }
  });

  revalidateTag("syllabus", "minutes");
  revalidateTag(`syllabus:${parsed.id}`, "minutes");
  revalidateTag("courses", "minutes");

  return {
    success: true,
    courseCode: selectedCourse?.code ?? null,
    title: nextTitle,
  };
}
