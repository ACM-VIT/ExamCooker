"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/app/auth";
import { revalidateTag } from "next/cache";
import { course, db, syllabi } from "@/db";

const schema = z.object({
  id: z.string().min(1),
  courseId: z.string().min(1).nullable(),
  title: z.string().trim().max(240),
});

function buildSyllabusName(input: {
  courseCode: string | null;
  title: string;
}) {
  const cleanTitle = input.title
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanTitle) {
    throw new Error("Title is required.");
  }

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

  const nextTitle = parsed.title.trim() || selectedCourse?.title || "";
  const nextName = buildSyllabusName({
    courseCode: selectedCourse?.code ?? null,
    title: nextTitle,
  });

  await db
    .update(syllabi)
    .set({
      name: nextName,
    })
    .where(eq(syllabi.id, parsed.id));

  revalidateTag("syllabus", "minutes");
  revalidateTag(`syllabus:${parsed.id}`, "minutes");
  revalidateTag("courses", "minutes");

  return {
    success: true,
    courseCode: selectedCourse?.code ?? null,
    title: nextTitle,
  };
}
