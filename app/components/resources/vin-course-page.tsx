import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import VinCourseBreadcrumbs from "@/app/components/resources/vin-course-breadcrumbs";
import VinCourseWorkspace from "@/app/components/resources/vin-course-workspace";
import { getVinCatalogMeta, type VinCourse } from "@/lib/data/vin-together";

type ResourceBreadcrumb = {
    label: string;
    href?: string;
};

type ResourceAction = {
    label: string;
    href: string;
    external?: boolean;
};

type VinCoursePageProps = {
    course: VinCourse;
    breadcrumbs?: ResourceBreadcrumb[];
    actions?: ResourceAction[];
    eyebrow?: string;
    intro?: string;
};

function buildSummaryParts(course: VinCourse) {
    const moduleCount = course.counts.moduleCount;
    const topicCount = course.counts.topicCount;
    const videoCount = course.counts.videoCount + course.counts.exampleVideoCount;
    const questionCount = course.counts.questionCount;
    const exampleCount = course.counts.exampleVideoCount;

    const parts: string[] = [];
    parts.push(`${moduleCount} module${moduleCount === 1 ? "" : "s"}`);
    parts.push(`${topicCount} topic${topicCount === 1 ? "" : "s"}`);
    if (videoCount > 0) {
        parts.push(`${videoCount} video${videoCount === 1 ? "" : "s"}`);
    }
    if (exampleCount > 0) {
        parts.push(
            `${exampleCount} worked example${exampleCount === 1 ? "" : "s"}`,
        );
    }
    if (questionCount > 0) {
        parts.push(
            `${questionCount} practice question${questionCount === 1 ? "" : "s"}`,
        );
    }
    return parts;
}

export default function VinCoursePage({
    course,
    breadcrumbs,
    actions,
}: VinCoursePageProps) {
    const meta = getVinCatalogMeta();
    const sourceCourseUrl = `${meta.source.origin}${course.remotePath}`;
    const actionItems: ResourceAction[] = [
        ...(actions ?? []),
        { label: "Original source", href: sourceCourseUrl, external: true },
    ];
    const summaryParts = buildSummaryParts(course);

    return (
        <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 pt-6 sm:gap-8 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10">
                {breadcrumbs?.length ? (
                    <VinCourseBreadcrumbs breadcrumbs={breadcrumbs} />
                ) : null}

                <header className="flex flex-col gap-3 pb-6 sm:pb-8">
                    <h1 className="text-3xl font-black leading-[1.05] tracking-tight text-black dark:text-[#D5D5D5] sm:text-4xl lg:text-5xl">
                        {course.displayName}
                    </h1>
                    {summaryParts.length > 0 ? (
                        <p className="text-[15px] leading-relaxed text-black/65 dark:text-[#D5D5D5]/65 sm:text-base">
                            {summaryParts.join(" · ")}
                        </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-2">
                        {actionItems.map((action) =>
                            action.external ? (
                                <a
                                    key={action.label}
                                    href={action.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 items-center gap-1.5 border border-black/20 bg-transparent px-2.5 text-[12px] font-semibold text-black/80 transition hover:border-black/45 hover:text-black dark:border-[#D5D5D5]/20 dark:text-[#D5D5D5]/80 dark:hover:border-[#D5D5D5]/45 dark:hover:text-[#D5D5D5]"
                                >
                                    {action.label}
                                    <ArrowUpRight className="h-3 w-3" />
                                </a>
                            ) : (
                                <Link
                                    key={action.label}
                                    href={action.href}
                                    transitionTypes={["nav-forward"]}
                                    className="inline-flex h-8 items-center gap-1.5 border border-black/20 bg-transparent px-2.5 text-[12px] font-semibold text-black/80 transition hover:border-black/45 hover:text-black dark:border-[#D5D5D5]/20 dark:text-[#D5D5D5]/80 dark:hover:border-[#D5D5D5]/45 dark:hover:text-[#D5D5D5]"
                                >
                                    {action.label}
                                </Link>
                            ),
                        )}
                    </div>
                </header>
            </div>

            <VinCourseWorkspace course={course} />
        </div>
    );
}
