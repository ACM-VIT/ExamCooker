import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import ModuleDropdown from "@/app/components/ModuleDropdown";
import VinCoursePage from "@/app/components/resources/VinCoursePage";
import DirectionalTransition from "@/app/components/common/DirectionalTransition";
import { notFound, permanentRedirect } from "next/navigation";
import ViewTracker from "@/app/components/ViewTracker";
import {
    buildKeywords,
    DEFAULT_KEYWORDS,
    getCourseResourcesPath,
    parseSubjectName,
} from "@/lib/seo";
import { getVinCourseById } from "@/lib/data/vinTogether";
import { db, module as moduleTable, type Module, subject, type Subject } from "@/db";

async function fetchLegacySubject(id: string) {
    const foundSubject = await db
        .select()
        .from(subject)
        .where(eq(subject.id, id))
        .then((rows) => rows[0] ?? null);

    if (!foundSubject) {
        return null;
    }

    const modules = await db
        .select()
        .from(moduleTable)
        .where(eq(moduleTable.subjectId, id))
        .orderBy(asc(moduleTable.title));

    return { ...foundSubject, modules };
}

function buildRemoteDescription(topicCount: number, displayName: string) {
    return `Study ${displayName} on ExamCooker with ${topicCount} structured topics, module-wise videos, takeaways, visual notes, and previous questions sourced from VInTogether.`;
}

function renderLegacySubject(subject: Subject & { modules: Module[] }) {
    const { courseCode, courseName } = parseSubjectName(subject.name);

    if (courseCode) {
        permanentRedirect(getCourseResourcesPath(courseCode));
    }

    return (
        <DirectionalTransition>
            <div className="transition-colors container mx-auto p-2 text-black dark:text-[#D5D5D5] sm:p-4">
                <ViewTracker id={subject.id} type="subject" title={subject.name} />
                <h2>{courseName}</h2>
                <br />
                {courseCode ? (
                    <>
                        <h3>Course Code: {courseCode}</h3>
                        <br />
                    </>
                ) : null}
                <br />
                <div className="space-y-6">
                    {subject.modules.map((module) => (
                        <ModuleDropdown key={module.id} module={module} />
                    ))}
                </div>
            </div>
        </DirectionalTransition>
    );
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const remoteCourse = getVinCourseById(id);

    if (remoteCourse) {
        return {
            title: `${remoteCourse.displayName} resources`,
            description: buildRemoteDescription(
                remoteCourse.counts.topicCount,
                remoteCourse.displayName,
            ),
            keywords: buildKeywords(DEFAULT_KEYWORDS, [
                remoteCourse.displayName,
                remoteCourse.shortName ?? "",
                ...remoteCourse.aliases,
            ]),
            alternates: { canonical: `/resources/${remoteCourse.slug}` },
            robots: { index: true, follow: true },
            openGraph: {
                title: `${remoteCourse.displayName} resources`,
                description: buildRemoteDescription(
                    remoteCourse.counts.topicCount,
                    remoteCourse.displayName,
                ),
                url: `/resources/${remoteCourse.slug}`,
            },
        };
    }

    const subject = await fetchLegacySubject(id);
    if (!subject) return {};

    const { courseCode, courseName } = parseSubjectName(subject.name);
    const canonical = courseCode
        ? getCourseResourcesPath(courseCode)
        : `/resources/${subject.id}`;
    const title = courseCode
        ? `${courseName} (${courseCode}) resources`
        : `${courseName} resources`;

    return {
        title,
        description: `Browse ${courseName} resources and modules on ExamCooker.`,
        keywords: buildKeywords(DEFAULT_KEYWORDS, [courseCode ?? "", courseName]),
        alternates: { canonical },
        openGraph: {
            title,
            description: `Browse ${courseName} resources and modules on ExamCooker.`,
            url: canonical,
        },
    };
}

export default async function SubjectDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const remoteCourse = getVinCourseById(id);

    if (remoteCourse) {
        if (id !== remoteCourse.slug) {
            permanentRedirect(`/resources/${remoteCourse.slug}`);
        }

        return (
            <DirectionalTransition>
                <VinCoursePage
                    course={remoteCourse}
                    breadcrumbs={[
                        { label: "Resources", href: "/resources" },
                        { label: remoteCourse.displayName },
                    ]}
                />
            </DirectionalTransition>
        );
    }

    const subject = await fetchLegacySubject(id);

    if (!subject) {
        notFound();
    }

    return renderLegacySubject(subject);
}
