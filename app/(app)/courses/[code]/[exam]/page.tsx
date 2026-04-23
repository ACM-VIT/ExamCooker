import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { examSlugToType, examTypeLabel, examTypeToSlug } from "@/lib/examSlug";
import { getCourseDetailByCode } from "@/lib/data/courseCatalog";
import { normalizeCourseCode } from "@/lib/courseTags";
import {
    buildCourseExamKeywordSet,
    getCourseExamPath,
} from "@/lib/seo";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ code: string; exam: string }>;
}): Promise<Metadata> {
    const { code, exam } = await params;
    const examType = examSlugToType(exam);
    if (!examType) return {};

    const course = await getCourseDetailByCode(normalizeCourseCode(code));
    if (!course) return {};

    const canonical = getCourseExamPath(course.code, examTypeToSlug(examType));
    const title = `${course.code} ${examTypeLabel(examType)} past papers | ${course.title}`;
    const description = `Canonical route: ${course.code} ${examTypeLabel(examType)} past papers on ExamCooker.`;

    return {
        title,
        description,
        keywords: buildCourseExamKeywordSet({
            code: course.code,
            title: course.title,
            aliases: course.aliases,
            examType,
        }),
        alternates: { canonical },
        robots: { index: false, follow: true },
    };
}

export default async function LegacyCourseExamPage({
    params,
}: {
    params: Promise<{ code: string; exam: string }>;
}) {
    const { code, exam } = await params;
    const examType = examSlugToType(exam);
    if (!examType) return notFound();

    const course = await getCourseDetailByCode(normalizeCourseCode(code));
    if (!course) return notFound();

    permanentRedirect(getCourseExamPath(course.code, examTypeToSlug(examType)));
}
