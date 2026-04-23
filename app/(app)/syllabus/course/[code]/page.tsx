import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PDFViewerClient from "@/app/components/PDFViewerClient";
import ViewTracker from "@/app/components/ViewTracker";
import StructuredData from "@/app/components/seo/StructuredData";
import { getCourseByCodeAny } from "@/lib/data/courses";
import { getCourseDetailByCode } from "@/lib/data/courseCatalog";
import { getSubjectByCourseCode } from "@/lib/data/resources";
import { getSyllabusDetailByCourseCode } from "@/lib/data/syllabus";
import { normalizeCourseCode } from "@/lib/courseTags";
import {
    absoluteUrl,
    buildCourseKeywordSet,
    formatSyllabusDisplayName,
    getCoursePath,
    getCourseSyllabusPath,
} from "@/lib/seo";
import {
    buildBreadcrumbList,
    buildCourseStructuredData,
    buildFaqPage,
} from "@/lib/structuredData";

async function loadCourseSyllabusContext(rawCode: string) {
    const normalized = normalizeCourseCode(rawCode);
    if (!normalized) return null;

    const [courseDetail, tagCourse, syllabus, subject] = await Promise.all([
        getCourseDetailByCode(normalized),
        getCourseByCodeAny(normalized),
        getSyllabusDetailByCourseCode(normalized),
        getSubjectByCourseCode(normalized),
    ]);

    if (!syllabus) return null;

    return {
        code: courseDetail?.code ?? tagCourse?.code ?? normalized,
        title:
            courseDetail?.title ??
            tagCourse?.title ??
            formatSyllabusDisplayName(syllabus.name),
        paperCount: courseDetail?.paperCount ?? 0,
        noteCount: courseDetail?.noteCount ?? 0,
        aliases: courseDetail?.aliases ?? [],
        syllabus,
        subject,
    };
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ code: string }>;
}): Promise<Metadata> {
    const { code } = await params;
    const context = await loadCourseSyllabusContext(code);
    if (!context) return {};

    const title = `${context.code} syllabus | ${context.title}`;
    const description = `View the ${context.code} syllabus PDF for ${context.title} on ExamCooker.`;
    const keywords = buildCourseKeywordSet({
        code: context.code,
        title: context.title,
        aliases: context.aliases,
        intents: ["syllabus", "course syllabus", "syllabus pdf", "unit wise syllabus", "course outline"],
    });

    return {
        title,
        description,
        keywords,
        alternates: { canonical: getCourseSyllabusPath(context.code) },
        robots: { index: true, follow: true },
        openGraph: { title, description, url: getCourseSyllabusPath(context.code) },
    };
}

export default async function CourseSyllabusPage({
    params,
}: {
    params: Promise<{ code: string }>;
}) {
    const { code } = await params;
    const context = await loadCourseSyllabusContext(code);
    if (!context) return notFound();

    const description = `View the ${context.code} syllabus PDF for ${context.title} on ExamCooker.`;

    return (
        <div className="flex flex-col lg:flex-row h-screen text-black dark:text-[#D5D5D5]">
            <StructuredData
                data={[
                    buildBreadcrumbList([
                        { name: "Syllabus", path: "/syllabus" },
                        { name: context.title, path: getCoursePath(context.code) },
                        { name: `${context.code} syllabus`, path: getCourseSyllabusPath(context.code) },
                    ]),
                    buildCourseStructuredData({
                        code: context.code,
                        title: context.title,
                        description,
                        path: getCourseSyllabusPath(context.code),
                    }),
                    {
                        "@context": "https://schema.org",
                        "@type": "DigitalDocument",
                        name: `${context.title} syllabus`,
                        description,
                        url: absoluteUrl(getCourseSyllabusPath(context.code)),
                        encodingFormat: "application/pdf",
                    },
                    buildFaqPage([
                        {
                            question: `Where can I find the ${context.code} syllabus PDF?`,
                            answer: `This page hosts the ${context.code} syllabus PDF for ${context.title}.`,
                        },
                    ]),
                ]}
            />

            <ViewTracker
                id={context.syllabus.id}
                type="syllabus"
                title={`${context.title} syllabus`}
            />

            <div className="lg:w-1/2 flex flex-col overflow-hidden">
                <div className="flex-grow overflow-y-auto p-2 sm:p-4 lg:p-8">
                    <div className="max-w-2xl mx-auto">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55 mb-4">
                            <Link href="/syllabus" className="hover:text-black dark:hover:text-[#D5D5D5]">Syllabus</Link>
                            <span aria-hidden="true">›</span>
                            <span>{context.code}</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">{context.title}</h1>
                    </div>
                </div>
            </div>

            <div className="flex-1 lg:w-1/2 overflow-hidden lg:border-l lg:border-black dark:lg:border-[#D5D5D5] p-2 sm:p-4">
                <div className="h-full overflow-auto">
                    <PDFViewerClient fileUrl={context.syllabus.fileUrl} />
                </div>
            </div>
        </div>
    );
}
