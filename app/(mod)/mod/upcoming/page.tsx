import React, { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/auth";
import { listUpcomingExamsForMod } from "@/lib/data/upcomingExams";
import UpcomingExamEditor from "@/app/components/mod/UpcomingExamEditor";
import type { CourseOption } from "@/app/components/mod/CoursePicker";
import { course, db } from "@/db";

export const metadata = {
    title: "Upcoming exams · Mod",
    robots: { index: false, follow: false },
};

function UpcomingExamsShell() {
    return (
        <div
            className="flex min-h-screen items-center justify-center bg-[#F5FAFD] dark:bg-transparent"
            aria-hidden="true"
        >
            <div className="h-8 w-8 animate-spin border-2 border-black border-t-transparent dark:border-[#D5D5D5] dark:border-t-transparent" />
        </div>
    );
}

async function UpcomingExamsContent() {
    const session = await auth();
    if (!session?.user) redirect("/");
    if (session.user.role !== "MODERATOR") notFound();

    const [courses, existing] = await Promise.all([
        db.select({
            id: course.id,
            code: course.code,
            title: course.title,
            aliases: course.aliases,
        }).from(course).orderBy(course.code),
        listUpcomingExamsForMod(),
    ]);

    const courseOptions: CourseOption[] = courses.map((row) => ({
        ...row,
        aliases: row.aliases ?? [],
    }));

    return (
        <div className="min-h-screen bg-[#F5FAFD] px-3 py-6 text-black dark:bg-transparent dark:text-[#D5D5D5] sm:px-6 lg:px-10">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                <header className="flex flex-wrap items-end justify-between gap-3 border-b border-black/20 pb-4 dark:border-[#D5D5D5]/20">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60">
                            Moderator
                        </p>
                        <h1 className="text-2xl font-bold">Upcoming exams</h1>
                        <p className="mt-1 text-sm text-black/70 dark:text-[#D5D5D5]/70">
                            Curate the upcoming exam slate. These surface on the home
                            page and drive quick access across the site.
                        </p>
                    </div>
                    <Link
                        href="/mod"
                        className="rounded-md border border-black/20 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-black/5 dark:border-[#D5D5D5]/20 dark:text-[#D5D5D5] dark:hover:bg-white/5"
                    >
                        ← Back to dashboard
                    </Link>
                </header>

                <UpcomingExamEditor courses={courseOptions} existing={existing} />
            </div>
        </div>
    );
}

export default function UpcomingExamsModPage() {
    return (
        <Suspense fallback={<UpcomingExamsShell />}>
            <UpcomingExamsContent />
        </Suspense>
    );
}
