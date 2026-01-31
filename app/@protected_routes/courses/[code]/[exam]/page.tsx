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

    if (!papers.length) return notFound();

    return (
        <div className="min-h-screen text-black dark:text-gray-200 flex flex-col gap-6 p-8">
            <header className="space-y-2 text-center">
                <h1 className="text-3xl sm:text-4xl font-bold">{course.title}</h1>
                <p className="text-sm text-black/70 dark:text-white/70">
                    {course.code} · {examType.label}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                    <Link
                        href={`/courses/${course.code}`}
                        className="text-xs underline text-black/70 dark:text-white/70"
                    >
                        Back to course
                    </Link>
                </div>
            </header>

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Past papers</h2>
                    <span className="text-xs text-black/60 dark:text-white/60">
                        {papers.length} results
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {papers.map((paper, index) => (
                        <PastPaperCard key={paper.id} pastPaper={paper} index={index} />
                    ))}
                </div>
            </section>
        </div>
    );
}
