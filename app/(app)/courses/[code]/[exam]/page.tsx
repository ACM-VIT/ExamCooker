import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PastPaperCard from "@/app/components/PastPaperCard";
import { getCourseByCodeAny } from "@/lib/data/courses";
import { normalizeCourseCode } from "@/lib/courseTags";
import { buildKeywords, DEFAULT_KEYWORDS } from "@/lib/seo";
import { getExamTypeBySlug } from "@/lib/examTypes";
import { getCourseExamPapers } from "@/lib/data/courseExams";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ code: string; exam: string }>;
}): Promise<Metadata> {
    const { code, exam } = await params;
    const normalized = normalizeCourseCode(code);
    const examType = getExamTypeBySlug(exam);
    const course = await getCourseByCodeAny(normalized);
    if (!examType || !course) return {};

    const title = `${course.code} ${examType.label} past papers | ${course.title}`;
    const description = `Download ${course.code} ${examType.label} previous year question papers on ExamCooker.`;
    const keywords = buildKeywords(DEFAULT_KEYWORDS, [
        course.title,
        course.code,
        examType.label,
        ...examType.keywords,
    ]);

    return {
        title,
        description,
        keywords,
        alternates: { canonical: `/courses/${course.code}/${examType.slug}` },
        openGraph: {
            title,
            description,
            url: `/courses/${course.code}/${examType.slug}`,
        },
    };
}

export default async function CourseExamPage({
    params,
}: {
    params: Promise<{ code: string; exam: string }>;
}) {
    const { code, exam } = await params;
    const normalized = normalizeCourseCode(code);
    const examType = getExamTypeBySlug(exam);
    const course = await getCourseByCodeAny(normalized);

    if (!examType || !course) return notFound();

    const papers = await getCourseExamPapers({
        tagIds: course.tagIds,
        examSlug: examType.slug,
    });

    return (
        <div className="min-h-screen text-black dark:text-[#D5D5D5] flex flex-col px-3 py-3 sm:p-4 lg:p-8">
            <div className="w-full max-w-6xl mx-auto flex flex-col">
                <header className="text-center mb-6 sm:mb-8">
                    <h1 className="leading-tight">
                        {examType.label}
                        <span className="block text-base font-normal text-black/60 dark:text-[#D5D5D5]/60 mt-2">
                            {course.title}
                        </span>
                    </h1>
                    <div className="mt-3">
                        <Link
                            href={`/courses/${course.code}`}
                            className="text-sm text-black/70 underline underline-offset-2 hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                        >
                            ← Back to {course.code}
                        </Link>
                    </div>
                </header>

                {papers.length > 0 ? (
                    <section>
                        <div className="mb-4 flex items-end justify-between gap-3">
                            <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-[#D5D5D5]">
                                Past papers
                            </h2>
                            <span className="text-sm text-black/60 dark:text-[#D5D5D5]/60">
                                {papers.length} {papers.length === 1 ? "result" : "results"}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                            {papers.map((paper, index) => (
                                <div
                                    key={paper.id}
                                    className="flex justify-center"
                                >
                                    <PastPaperCard
                                        pastPaper={paper}
                                        index={index}
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                ) : (
                    <p className="text-center text-sm text-black/60 dark:text-[#D5D5D5]/60">
                        No {examType.label} papers yet for this course.
                    </p>
                )}
            </div>
        </div>
    );
}
