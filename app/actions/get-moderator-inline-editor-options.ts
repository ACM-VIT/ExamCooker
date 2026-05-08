"use server";

import { asc } from "drizzle-orm";
import { auth } from "@/app/auth";
import { course, db, tag } from "@/db";

export async function getModeratorInlineEditorOptions() {
  const session = await auth();
  if (session?.user?.role !== "MODERATOR") {
    throw new Error("Access denied");
  }

  const [courses, tags] = await Promise.all([
    db
      .select({
        id: course.id,
        code: course.code,
        title: course.title,
        aliases: course.aliases,
      })
      .from(course)
      .orderBy(asc(course.code)),
    db
      .select({
        name: tag.name,
      })
      .from(tag)
      .orderBy(asc(tag.name)),
  ]);

  return {
    courses: courses.map((entry) => ({
      ...entry,
      aliases: entry.aliases ?? [],
    })),
    tags: tags.map((entry) => entry.name),
  };
}
