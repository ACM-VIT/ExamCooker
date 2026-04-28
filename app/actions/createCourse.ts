"use server";

import { eq } from "drizzle-orm";
import { auth } from "@/app/auth";
import { normalizeCourseCode } from "@/lib/courseTags";
import { revalidateTag } from "next/cache";
import { course, db } from "@/db";

export async function createCourse(input: {
    code: string;
    title: string;
}): Promise<
    | { success: true; id: string; code: string; title: string; aliases: string[] }
    | { success: false; error: string }
> {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") {
        return { success: false, error: "Unauthorized" };
    }

    const code = normalizeCourseCode(input.code.trim());
    const title = input.title.trim();

    if (!code) return { success: false, error: "Invalid course code" };
    if (!title) return { success: false, error: "Title is required" };

    try {
        const existingCourses = await db
            .select({
                id: course.id,
                code: course.code,
                title: course.title,
                aliases: course.aliases,
            })
            .from(course)
            .where(eq(course.code, code));
        const existingCourse = existingCourses[0] ?? null;

        let createdCourse = existingCourse;
        if (!createdCourse) {
            const createdCourses = await db
                .insert(course)
                .values({ code, title, aliases: [title] })
                .returning({
                    id: course.id,
                    code: course.code,
                    title: course.title,
                    aliases: course.aliases,
                });
            createdCourse = createdCourses[0] ?? null;
        }

        if (!createdCourse) {
            return { success: false, error: "Failed to create course" };
        }

        revalidateTag("courses", "minutes");
        return {
            success: true,
            id: createdCourse.id,
            code: createdCourse.code,
            title: createdCourse.title,
            aliases: createdCourse.aliases ?? [],
        };
    } catch {
        return { success: false, error: "Failed to create course" };
    }
}
