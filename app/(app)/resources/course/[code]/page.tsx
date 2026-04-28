import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ModuleDropdown from "@/app/components/ModuleDropdown";
import VinCoursePage from "@/app/components/resources/VinCoursePage";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import ViewTracker from "@/app/components/ViewTracker";
import StructuredData from "@/app/components/seo/StructuredData";
import { getCourseByCodeAny } from "@/lib/data/courses";
import { getCourseDetailByCode } from "@/lib/data/courseCatalog";
import { findVinCourseByNames, type VinCourse } from "@/lib/data/vinTogether";
import { getSubjectByCourseCode } from "@/lib/data/resources";
import { getSyllabusByCourseCode } from "@/lib/data/syllabus";
import { normalizeCourseCode } from "@/lib/courseTags";
import {
    buildCourseKeywordSet,
    getCourseNotesPath,
    getCoursePastPapersPath,
    getCoursePath,
    getCourseResourcesPath,
    getCourseSyllabusPath,
    parseSubjectName,
} from "@/lib/seo";
import {
    buildBreadcrumbList,
    buildCollectionPage,
    buildCourseStructuredData,
    buildFaqPage,
} from "@/lib/structuredData";

type CourseResourceContext = {
    code: string;
    title: string;
    aliases: string[];
    paperCount: number;
    noteCount: number;
    syllabus: Awaited<ReturnType<typeof getSyllabusByCourseCode>>;
    legacySubject: Awaited<ReturnType<typeof getSubjectByCourseCode>>;
    remoteCourse: VinCourse | null;
};

async function loadCourseResourceContext(rawCode: string): Promise<CourseResourceContext | null> {
    const normalized = normalizeCourseCode(rawCode);
    if (!normalized) return null;

    const [legacySubject, courseDetail, tagCourse, syllabus] = await Promise.all([
        getSubjectByCourseCode(normalized),
        getCourseDetailByCode(normalized),
        getCourseByCodeAny(normalized),
        getSyllabusByCourseCode(normalized),
    ]);

    if (!legacySubject && !courseDetail && !tagCourse) return null;

    const parsed = legacySubject ? parseSubjectName(legacySubject.name) : null;
    const title =
        courseDetail?.title ??
        tagCourse?.title ??
        parsed?.courseName ??
        normalized;
    const aliases = courseDetail?.aliases ?? [];
    const remoteCourse = findVinCourseByNames([
        normalized,
        title,
        ...aliases,
    ]);

    return {
        code: courseDetail?.code ?? tagCourse?.code ?? parsed?.courseCode ?? normalized,
        title,
        aliases,
        paperCount: courseDetail?.paperCount ?? 0,
        noteCount: courseDetail?.noteCount ?? 0,
        syllabus,
        legacySubject,
        remoteCourse,
    };
}

function buildDescription(context: CourseResourceContext) {
    if (context.remoteCourse) {
        return `Study ${context.title} resources, topic-wise videos, takeaways, visual notes, and previous questions for ${context.code} on ExamCooker.`;
    }

    return `Browse ${context.title} course resources, module links, web references, and videos for ${context.code} on ExamCooker.`;
}

function buildFaq(context: CourseResourceContext) {
    return [
        {
            question: `Where can I find ${context.code} course resources?`,
            answer: `This page groups the study material for ${context.code} so you can move from module-level concepts to revision material without hunting across unrelated pages.`,
        },
        {
            question: `How should I use ${context.code} resources for exam prep?`,
            answer: `Start with the resource modules for concept coverage, use notes to revise, then move to past papers to practice the question patterns that show up repeatedly.`,
        },
    ];
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ code: string }>;
}): Promise<Metadata> {
    const { code } = await params;
    const context = await loadCourseResourceContext(code);
    if (!context) return {};

    const title = `${context.code} resources | ${context.title}`;
    const description = buildDescription(context);
    const keywords = buildCourseKeywordSet({
        code: context.code,
        title: context.title,
        aliases: context.aliases,
        intents: context.remoteCourse
            ? [
                  "resources",
                  "study material",
                  "topic videos",
                  "previous questions",
                  "revision notes",
              ]
            : [
                  "resources",
                  "course resources",
                  "module resources",
                  "reference material",
                  "youtube lectures",
              ],
    });

    return {
        title,
        description,
        keywords,
        alternates: { canonical: getCourseResourcesPath(context.code) },
        robots: { index: true, follow: true },
        openGraph: {
            title,
            description,
            url: getCourseResourcesPath(context.code),
        },
    };
}

function CourseResourcesShell() {
    return (
        <div
            className="container mx-auto px-3 py-6 sm:px-5 lg:px-8 lg:py-10"
            aria-hidden="true"
        >
            <div className="mx-auto flex max-w-6xl flex-col gap-4">
                <span className="h-3 w-32 bg-black/10 dark:bg-white/10" />
                <span className="h-9 w-2/3 bg-black/10 dark:bg-white/10 sm:h-10 lg:h-12" />
            </div>
            <div className="mx-auto mt-6 grid max-w-6xl grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="rounded-md border border-black/10 bg-white px-4 py-3 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]"
                    >
                        <span className="block h-3 w-16 bg-black/10 dark:bg-white/10" />
                        <span className="mt-2 block h-6 w-12 bg-black/10 dark:bg-white/10" />
                    </div>
                ))}
            </div>
            <div className="mx-auto mt-8 max-w-6xl space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-14 rounded-md border border-black/10 bg-white dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]"
                    />
                ))}
            </div>
        </div>
    );
}

async function CourseResourcesContent({
    paramsPromise,
}: {
    paramsPromise: Promise<{ code: string }>;
}) {
    const { code } = await paramsPromise;
    const context = await loadCourseResourceContext(code);
    if (!context) return notFound();

    const description = buildDescription(context);
    const faq = buildFaq(context);
    const actionLinks = [
        { label: "Course page", href: getCoursePath(context.code) },
        ...(context.noteCount > 0
            ? [{ label: "Notes", href: getCourseNotesPath(context.code) }]
            : []),
        ...(context.paperCount > 0
            ? [{ label: "Past papers", href: getCoursePastPapersPath(context.code) }]
            : []),
        ...(context.syllabus
            ? [{ label: "Syllabus", href: getCourseSyllabusPath(context.code) }]
            : []),
    ];

    return (
        <>
            <StructuredData
                data={[
                    buildBreadcrumbList([
                        { name: "Resources", path: "/resources" },
                        { name: context.title, path: getCoursePath(context.code) },
                        {
                            name: `${context.code} resources`,
                            path: getCourseResourcesPath(context.code),
                        },
                    ]),
                    buildCollectionPage({
                        name: `${context.code} resources`,
                        description,
                        path: getCourseResourcesPath(context.code),
                        about: context.title,
                    }),
                    buildCourseStructuredData({
                        code: context.code,
                        title: context.title,
                        description,
                        path: getCourseResourcesPath(context.code),
                    }),
                    buildFaqPage(faq),
                ]}
            />

            {context.remoteCourse ? (
                <VinCoursePage
                    course={context.remoteCourse}
                    breadcrumbs={[
                        { label: "Resources", href: "/resources" },
                        { label: context.code, href: getCoursePath(context.code) },
                        { label: `${context.code} resources` },
                    ]}
                    actions={actionLinks}
                />
            ) : null}

            {!context.remoteCourse && context.legacySubject ? (
                <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                    <div className="container mx-auto px-3 py-6 sm:px-5 lg:px-8 lg:py-10">
                        <ViewTracker
                            id={context.legacySubject.id}
                            type="subject"
                            title={context.legacySubject.name}
                        />

                        <header className="mx-auto flex max-w-6xl flex-col gap-4">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
                                <Link
                                    href="/resources"
                                    transitionTypes={["nav-back"]}
                                    className="hover:text-black dark:hover:text-[#D5D5D5]"
                                >
                                    Resources
                                </Link>
                                <span aria-hidden="true">›</span>
                                <Link
                                    href={getCoursePath(context.code)}
                                    transitionTypes={["nav-back"]}
                                    className="hover:text-black dark:hover:text-[#D5D5D5]"
                                >
                                    {context.code}
                                </Link>
                            </div>

                            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                <div className="max-w-4xl">
                                    <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-black/55 dark:text-[#3BF4C7]/80">
                                        {context.code}
                                    </p>
                                    <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                                        {context.title} resources
                                    </h1>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {actionLinks.map((action) => (
                                        <Link
                                            key={action.label}
                                            href={action.href}
                                            transitionTypes={["nav-forward"]}
                                            className="inline-flex h-9 items-center border border-black/20 px-3 text-sm font-semibold transition hover:bg-black/5 dark:border-[#D5D5D5]/20 dark:hover:bg-white/5"
                                        >
                                            {action.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </header>

                        <div className="mx-auto mt-6 grid max-w-6xl grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="rounded-md border border-black/10 bg-white px-4 py-3 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]">
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-black/55 dark:text-[#D5D5D5]/55">
                                    Modules
                                </div>
                                <div className="mt-1 text-2xl font-black">
                                    {context.legacySubject.modules.length}
                                </div>
                            </div>
                            <div className="rounded-md border border-black/10 bg-white px-4 py-3 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]">
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-black/55 dark:text-[#D5D5D5]/55">
                                    Papers
                                </div>
                                <div className="mt-1 text-2xl font-black">{context.paperCount}</div>
                            </div>
                            <div className="rounded-md border border-black/10 bg-white px-4 py-3 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]">
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-black/55 dark:text-[#D5D5D5]/55">
                                    Notes
                                </div>
                                <div className="mt-1 text-2xl font-black">{context.noteCount}</div>
                            </div>
                            <div className="rounded-md border border-black/10 bg-white px-4 py-3 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]">
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-black/55 dark:text-[#D5D5D5]/55">
                                    Syllabus
                                </div>
                                <div className="mt-1 text-2xl font-black">
                                    {context.syllabus ? "Yes" : "No"}
                                </div>
                            </div>
                        </div>

                        <section className="mx-auto mt-8 max-w-6xl space-y-6">
                            <div className="rounded-md border border-black/10 bg-white p-4 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222] sm:p-6">
                                {context.legacySubject.modules.length > 0 ? (
                                    context.legacySubject.modules.map((module) => (
                                        <ModuleDropdown key={module.id} module={module} />
                                    ))
                                ) : (
                                    <p className="text-sm text-black/70 dark:text-[#D5D5D5]/70">
                                        No module resources have been added for this course yet.
                                    </p>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            ) : null}
        </>
    );
}

export default function CourseResourcesPage({
    params,
}: {
    params: Promise<{ code: string }>;
}) {
    return (
        <DirectionalTransition>
            <Suspense fallback={<CourseResourcesShell />}>
                <CourseResourcesContent paramsPromise={params} />
            </Suspense>
        </DirectionalTransition>
    );
}
