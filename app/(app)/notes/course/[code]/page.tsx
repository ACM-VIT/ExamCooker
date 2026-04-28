import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import CourseNotesGrid from "@/app/components/notes/CourseNotesGrid";
import Pagination from "@/app/components/Pagination";
import StructuredData from "@/app/components/seo/StructuredData";
import { getCourseDetailByCode } from "@/lib/data/courseCatalog";
import {
    getCourseNotesCount,
    getCourseNotesPage,
} from "@/lib/data/notes";
import { getSubjectByCourseCode } from "@/lib/data/resources";
import { normalizeCourseCode } from "@/lib/courseTags";
import {
    buildCourseKeywordSet,
    getCourseNotesPath,
    getCoursePath,
    getCourseResourcesPath,
} from "@/lib/seo";
import {
    buildBreadcrumbList,
    buildCollectionPage,
    buildCourseStructuredData,
    buildFaqPage,
    buildItemList,
} from "@/lib/structuredData";

const PAGE_SIZE = 12;

function stripPdfExtension(value: string) {
    return value.replace(/\.pdf$/i, "").trim();
}

async function loadCourseContext(rawCode: string) {
    const normalized = normalizeCourseCode(rawCode);
    if (!normalized) return null;

    const courseDetail = await getCourseDetailByCode(normalized);
    if (!courseDetail) return null;

    return {
        code: courseDetail.code,
        title: courseDetail.title,
        aliases: courseDetail.aliases,
        courseId: courseDetail.id,
    };
}

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ code: string }>;
    searchParams?: Promise<{ page?: string }>;
}): Promise<Metadata> {
    const [{ code }, rawSearchParams] = await Promise.all([params, searchParams]);
    const course = await loadCourseContext(code);
    if (!course) return {};

    const page = Number.parseInt(rawSearchParams?.page || "1", 10) || 1;
    const noteCount = await getCourseNotesCount({ courseId: course.courseId });

    if (!noteCount) return {};

    const title = `${course.code} notes | ${course.title}`;
    const description = `Download ${course.code} notes, lecture notes, revision material, and study PDFs for ${course.title} on ExamCooker.`;
    const keywords = buildCourseKeywordSet({
        code: course.code,
        title: course.title,
        aliases: course.aliases,
        intents: [
            "notes",
            "lecture notes",
            "revision notes",
            "study material",
            "study notes",
            "notes pdf",
        ],
        extras: [
            `${course.code} notes pdf`,
            `${course.title} notes pdf`,
        ],
    });

    return {
        title,
        description,
        keywords,
        alternates: { canonical: getCourseNotesPath(course.code) },
        robots: { index: page <= 1, follow: true },
        openGraph: {
            title,
            description,
            url: getCourseNotesPath(course.code),
        },
    };
}

function CourseNotesShell() {
    return (
        <div
            className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-6 sm:px-6 lg:px-10 lg:py-10"
            aria-hidden="true"
        >
            <header className="flex flex-col gap-4">
                <span className="h-3 w-32 bg-black/10 dark:bg-white/10" />
                <span className="h-9 w-2/3 bg-black/10 dark:bg-white/10 sm:h-10 lg:h-12" />
            </header>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-40 border border-black/10 bg-white dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]"
                    />
                ))}
            </div>
        </div>
    );
}

async function CourseNotesContent({
    paramsPromise,
    searchParamsPromise,
}: {
    paramsPromise: Promise<{ code: string }>;
    searchParamsPromise: Promise<{ page?: string }> | undefined;
}) {
    const [{ code }, rawSearchParams] = await Promise.all([
        paramsPromise,
        searchParamsPromise,
    ]);
    const course = await loadCourseContext(code);
    if (!course) return notFound();

    const requestedPage = Math.max(
        1,
        Number.parseInt(rawSearchParams?.page || "1", 10) || 1,
    );

    const [noteCount, subject] = await Promise.all([
        getCourseNotesCount({ courseId: course.courseId }),
        getSubjectByCourseCode(course.code),
    ]);

    if (!noteCount) return notFound();

    const totalPages = Math.max(1, Math.ceil(noteCount / PAGE_SIZE));
    if (requestedPage > totalPages) {
        redirect(getCourseNotesPath(course.code));
    }

    const notes = await getCourseNotesPage({
        courseId: course.courseId,
        page: requestedPage,
        pageSize: PAGE_SIZE,
    });

    const description = `Download ${course.code} notes, lecture notes, revision material, and study PDFs for ${course.title} on ExamCooker.`;
    const keywords = buildCourseKeywordSet({
        code: course.code,
        title: course.title,
        aliases: course.aliases,
        intents: [
            "notes",
            "lecture notes",
            "revision notes",
            "study material",
            "study notes",
            "notes pdf",
        ],
    });

    const faq = [
        {
            question: `Where can I find ${course.code} notes?`,
            answer: `ExamCooker collects ${course.code} notes, lecture notes, and study PDFs for ${course.title} in one course page so students can browse them without using search filters.`,
        },
        {
            question: `Does this page include ${course.code} revision material and lecture notes?`,
            answer: `Yes. This page groups revision notes, lecture notes, and study material that match ${course.code} and ${course.title}.`,
        },
        {
            question: `What else should I use with ${course.code} notes?`,
            answer: `Use these notes together with past papers, the syllabus, and module resources for ${course.title} to cover both concepts and exam pattern.`,
        },
    ];

    return (
        <>
            <StructuredData
                data={[
                    buildBreadcrumbList([
                        { name: "Notes", path: "/notes" },
                        { name: course.title, path: getCoursePath(course.code) },
                        {
                            name: `${course.code} notes`,
                            path: getCourseNotesPath(course.code),
                        },
                    ]),
                    buildCollectionPage({
                        name: `${course.code} notes`,
                        description,
                        path: getCourseNotesPath(course.code),
                        keywords,
                        about: course.title,
                    }),
                    buildCourseStructuredData({
                        code: course.code,
                        title: course.title,
                        description: `Course overview page for ${course.title}.`,
                        path: getCoursePath(course.code),
                    }),
                    buildItemList(
                        notes.map((note) => ({
                            name: stripPdfExtension(note.title),
                            path: `/notes/${note.id}`,
                        })),
                    ),
                    buildFaqPage(faq),
                ]}
            />

            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-6 sm:px-6 lg:px-10 lg:py-10">
                <header className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm text-black/50 dark:text-[#D5D5D5]/50">
                        <Link
                            href="/notes"
                            transitionTypes={["nav-back"]}
                            className="hover:text-black dark:hover:text-[#D5D5D5]"
                        >
                            Notes
                        </Link>
                        <span aria-hidden="true">/</span>
                        <Link
                            href={getCoursePath(course.code)}
                            transitionTypes={["nav-back"]}
                            className="hover:text-black dark:hover:text-[#D5D5D5]"
                        >
                            {course.code}
                        </Link>
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-4xl">
                            <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                                {course.title} notes
                            </h1>
                            <p className="sr-only">
                                Download {course.code} lecture notes, study material, revision PDFs,
                                and prep resources for {course.title}. Use it as the main notes
                                collection for the course instead of digging through generic search
                                results.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {subject && (
                                <Link
                                    href={getCourseResourcesPath(course.code)}
                                    transitionTypes={["nav-forward"]}
                                    className="inline-flex h-9 items-center border-2 border-[#5FC4E7] bg-[#5FC4E7]/40 px-3 text-sm font-semibold transition hover:bg-[#5FC4E7]/60 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/15"
                                >
                                    Resources
                                </Link>
                            )}
                        </div>
                    </div>
                </header>

                <CourseNotesGrid
                    notes={notes}
                    courseCode={course.code}
                    courseTitle={course.title}
                />

                {totalPages > 1 && (
                    <Pagination
                        currentPage={requestedPage}
                        totalPages={totalPages}
                        basePath={getCourseNotesPath(course.code)}
                    />
                )}

                <section className="sr-only">
                    {faq.map((item) => (
                        <article
                            key={item.question}
                            className="rounded-md border border-black/10 bg-white p-4 dark:border-[#D5D5D5]/10 dark:bg-[#0C1222]"
                        >
                            <h2 className="text-base font-bold">{item.question}</h2>
                            <p className="mt-2 text-sm text-black/70 dark:text-[#D5D5D5]/70">
                                {item.answer}
                            </p>
                        </article>
                    ))}
                </section>
            </div>
        </>
    );
}

export default function CourseNotesPage({
    params,
    searchParams,
}: {
    params: Promise<{ code: string }>;
    searchParams?: Promise<{ page?: string }>;
}) {
    return (
        <DirectionalTransition>
            <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <Suspense fallback={<CourseNotesShell />}>
                    <CourseNotesContent
                        paramsPromise={params}
                        searchParamsPromise={searchParams}
                    />
                </Suspense>
            </div>
        </DirectionalTransition>
    );
}
