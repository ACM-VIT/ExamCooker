import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { auth } from "@/app/auth";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import PaperReviewList from "@/app/components/mod/PaperReviewList";
import type { CourseOption } from "@/app/components/mod/CoursePicker";
import type { PaperRowData } from "@/app/components/mod/PaperReviewRow";

export const metadata = {
    title: "Paper metadata review · Mod",
    robots: { index: false, follow: false },
};

export default async function PaperReviewPage() {
    const session = await auth();
    if (!session?.user) redirect("/");
    // @ts-ignore
    if (session.user.role !== "MODERATOR") notFound();

    const [papers, courses] = await Promise.all([
        prisma.pastPaper.findMany({
            where: {
                OR: [{ courseId: null }, { examType: null }, { year: null }],
            },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
                id: true,
                title: true,
                thumbNailUrl: true,
                courseId: true,
                examType: true,
                slot: true,
                year: true,
                semester: true,
                campus: true,
                hasAnswerKey: true,
            },
        }),
        prisma.course.findMany({
            select: { id: true, code: true, title: true, aliases: true },
            orderBy: { code: "asc" },
            take: 500,
        }),
    ]);

    const rows: PaperRowData[] = papers.map((p) => ({
        ...p,
        thumbNailUrl: normalizeGcsUrl(p.thumbNailUrl) ?? p.thumbNailUrl,
    }));
    const courseOptions: CourseOption[] = courses;

    return (
        <div className="min-h-screen bg-[#F5FAFD] px-3 py-6 text-black dark:bg-transparent dark:text-[#D5D5D5] sm:px-6 lg:px-10">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <header className="flex flex-wrap items-end justify-between gap-3 border-b border-black/20 pb-4 dark:border-[#D5D5D5]/20">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60">
                            Moderator
                        </p>
                        <h1 className="text-2xl font-bold">Paper metadata review</h1>
                        <p className="mt-1 text-sm text-black/70 dark:text-[#D5D5D5]/70">
                            Papers missing course, exam, or year. Fill in the gaps and save —
                            the row drops off the queue automatically.
                        </p>
                    </div>
                    <Link
                        href="/mod"
                        className="border border-black/30 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-black/5 dark:border-[#D5D5D5]/40 dark:text-[#D5D5D5] dark:hover:bg-white/5"
                    >
                        ← Back to dashboard
                    </Link>
                </header>

                <PaperReviewList initialPapers={rows} courses={courseOptions} />
            </div>
        </div>
    );
}
