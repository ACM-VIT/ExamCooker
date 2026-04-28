import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq, isNull } from "drizzle-orm";
import { auth } from "@/app/auth";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import NoteReviewList from "@/app/components/mod/NoteReviewList";
import type { CourseOption } from "@/app/components/mod/CoursePicker";
import type { NoteRowData } from "@/app/components/mod/NoteReviewRow";
import { course, db, note } from "@/db";

export const metadata = {
    title: "Note metadata review · Mod",
    robots: { index: false, follow: false },
};

export default async function NoteReviewPage() {
    const session = await auth();
    if (!session?.user) redirect("/");
    if (session.user.role !== "MODERATOR") notFound();

    const [notes, courses] = await Promise.all([
        db
            .select({
                id: note.id,
                title: note.title,
                thumbNailUrl: note.thumbNailUrl,
                courseId: note.courseId,
            })
            .from(note)
            .where(isNull(note.courseId))
            .orderBy(desc(note.createdAt))
            .limit(100),
        db
            .select({
                id: course.id,
                code: course.code,
                title: course.title,
                aliases: course.aliases,
            })
            .from(course)
            .orderBy(course.code)
            .limit(500),
    ]);

    const rows: NoteRowData[] = notes.map((n) => ({
        ...n,
        thumbNailUrl: normalizeGcsUrl(n.thumbNailUrl) ?? n.thumbNailUrl,
    }));
    const courseOptions: CourseOption[] = courses.map((row) => ({
        ...row,
        aliases: row.aliases ?? [],
    }));

    return (
        <div className="min-h-screen bg-[#F5FAFD] px-3 py-6 text-black dark:bg-transparent dark:text-[#D5D5D5] sm:px-6 lg:px-10">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <header className="flex flex-wrap items-end justify-between gap-3 border-b border-black/20 pb-4 dark:border-[#D5D5D5]/20">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60">
                            Moderator
                        </p>
                        <h1 className="text-2xl font-bold">Note metadata review</h1>
                        <p className="mt-1 text-sm text-black/70 dark:text-[#D5D5D5]/70">
                            Notes without a course assigned. Pick the right course and save.
                        </p>
                    </div>
                    <Link
                        href="/mod"
                        className="border border-black/30 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-black/5 dark:border-[#D5D5D5]/40 dark:text-[#D5D5D5] dark:hover:bg-white/5"
                    >
                        ← Back to dashboard
                    </Link>
                </header>

                <NoteReviewList initialNotes={rows} courses={courseOptions} />
            </div>
        </div>
    );
}
