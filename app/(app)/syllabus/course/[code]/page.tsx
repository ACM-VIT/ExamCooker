import { Suspense } from "react";
import PageBreadcrumbRow from "@/app/components/common/page-breadcrumb-row";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PDFViewerClient from "@/app/components/pdf-viewer-client";
import ViewTracker from "@/app/components/view-tracker";
import StructuredData from "@/app/components/seo/structured-data";
import DirectionalTransition from "@/app/components/common/directional-transition";
import { getCourseByCodeAny } from "@/lib/data/courses";
import { getCourseDetailByCode } from "@/lib/data/course-catalog";
import { getSubjectByCourseCode } from "@/lib/data/resources";
import { getSyllabusDetailByCourseCode } from "@/lib/data/syllabus";
import { normalizeCourseCode } from "@/lib/course-tags";
import {
    absoluteUrl,
    buildCourseKeywordSet,
    formatSyllabusDisplayName,
    getCoursePath,
    getCourseSyllabusPath,
} from "@/lib/seo";
import { buildSyllabusPdfFileName } from "@/lib/downloads/resource-names";
import {
    buildBreadcrumbList,
    buildCourseStructuredData,
    buildFaqPage,
} from "@/lib/structured-data";

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
    if (!context) return { robots: { index: false, follow: true } };

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

function CourseSyllabusShell() {
    return (
        <div
            className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 xl:px-10"
            aria-hidden="true"
        >
            <span className="h-3 w-32 bg-black/10 dark:bg-white/10" />
            <span className="h-9 w-2/3 bg-black/10 dark:bg-white/10 sm:h-10 lg:h-12" />
            <div className="h-[70dvh] border border-black/15 bg-white dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] sm:h-[78dvh] lg:h-[84dvh] xl:h-[86dvh]" />
        </div>
    );
}

async function CourseSyllabusContent({
    paramsPromise,
}: {
    paramsPromise: Promise<{ code: string }>;
}) {
    const { code } = await paramsPromise;
    const context = await loadCourseSyllabusContext(code);
    if (!context) return notFound();

    const description = `View the ${context.code} syllabus PDF for ${context.title} on ExamCooker.`;
    const downloadFileName = buildSyllabusPdfFileName({
        courseCode: context.code,
        courseTitle: context.title,
    });

    return (
        <>
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

                <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 xl:px-10">
                    <PageBreadcrumbRow
                        items={[
                            { label: "Syllabus", href: "/syllabus" },
                            { label: context.title },
                        ]}
                    />

                    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-pretty text-2xl font-bold leading-[1.15] tracking-tight sm:text-3xl lg:text-4xl">
                                {context.title}
                            </h1>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                <span className="inline-flex items-center gap-1.5 border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]">
                                    <span className="text-[10px] uppercase tracking-wider text-black/45 dark:text-[#D5D5D5]/45">
                                        Course
                                    </span>
                                    <span>{context.code}</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5 border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]">
                                    <span className="text-[10px] uppercase tracking-wider text-black/45 dark:text-[#D5D5D5]/45">
                                        Type
                                    </span>
                                    <span>Syllabus</span>
                                </span>
                            </div>
                        </div>
                    </header>

                    <div className="overflow-hidden border border-black/15 bg-white shadow-[0_4px_28px_-14px_rgba(0,0,0,0.25)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:shadow-[0_4px_28px_-14px_rgba(0,0,0,0.6)]">
                        <div className="h-[70dvh] sm:h-[78dvh] lg:h-[84dvh] xl:h-[86dvh]">
                            <PDFViewerClient
                                fileUrl={context.syllabus.fileUrl}
                                fileName={downloadFileName}
                            />
                        </div>
                    </div>
                </div>
        </>
    );
}

export default function CourseSyllabusPage({
    params,
}: {
    params: Promise<{ code: string }>;
}) {
    return (
        <DirectionalTransition>
            <div className="min-h-dvh bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <Suspense fallback={<CourseSyllabusShell />}>
                    <CourseSyllabusContent paramsPromise={params} />
                </Suspense>
            </div>
        </DirectionalTransition>
    );
}
