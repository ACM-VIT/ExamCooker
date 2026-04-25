"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/app/auth";
import { normalizeCourseCode } from "@/lib/courseTags";
import { revalidateTag } from "next/cache";

export async function createCourse(input: {
    code: string;
    title: string;
}): Promise<
    | { success: true; id: string; code: string; title: string; aliases: string[] }
    | { success: false; error: string }
> {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!session?.user || role !== "MODERATOR") {
        return { success: false, error: "Unauthorized" };
    }

    const code = normalizeCourseCode(input.code.trim());
    const title = input.title.trim();

    if (!code) return { success: false, error: "Invalid course code" };
    if (!title) return { success: false, error: "Title is required" };

    try {
        const course = await prisma.course.upsert({
            where: { code },
            update: {},
            create: { code, title, aliases: [title] },
            select: { id: true, code: true, title: true, aliases: true },
        });
        revalidateTag("courses", "minutes");
        return {
            success: true,
            id: course.id,
            code: course.code,
            title: course.title,
            aliases: course.aliases,
        };
    } catch {
        return { success: false, error: "Failed to create course" };
    }
}
