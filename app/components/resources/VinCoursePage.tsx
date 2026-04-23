import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import AppImage from "@/app/components/common/AppImage";
import ResourceBookmarkButton from "@/app/components/resources/ResourceBookmarkButton";
import ModuleJourney from "@/app/components/resources/ModuleJourney";
import VinCourseExplorer from "@/app/components/resources/VinCourseExplorer";
import { getVinCatalogMeta, type VinCourse } from "@/lib/data/vinTogether";

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

export default function VinCoursePage({
    course,
    breadcrumbs,
    actions,
}: VinCoursePageProps) {
    const meta = getVinCatalogMeta();
    const sourceCourseUrl = `${meta.source.origin}${course.remotePath}`;
    const totalVideos = course.counts.videoCount + course.counts.exampleVideoCount;
    const actionItems: ResourceAction[] = [
        ...(actions ?? []),
        { label: "Original source", href: sourceCourseUrl, external: true },
    ];

    return (
        <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-6 sm:gap-10 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
                {/* Breadcrumbs */}
                {breadcrumbs?.length ? (
                    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-black/50 dark:text-[#D5D5D5]/50">
                        {breadcrumbs.map((crumb, i) => (
                            <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1.5">
                                {crumb.href ? (
                                    <Link href={crumb.href} className="hover:text-black dark:hover:text-[#D5D5D5]">
                                        {crumb.label}
                                    </Link>
                                ) : (
                                    <span className="text-black dark:text-[#D5D5D5]">{crumb.label}</span>
                                )}
                                {i < breadcrumbs.length - 1 && <span aria-hidden="true">/</span>}
                            </span>
                        ))}
                    </nav>
                ) : null}

                {/* Hero: Title + image side by side */}
                <section className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div className="flex flex-col gap-4">
                        <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                            {course.displayName}
                        </h1>

                        {/* Compact stats line */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-black/60 dark:text-[#D5D5D5]/60">
                            <span><b className="text-black dark:text-[#D5D5D5]">{course.counts.moduleCount}</b> modules</span>
                            <span><b className="text-black dark:text-[#D5D5D5]">{course.counts.topicCount}</b> topics</span>
                            {totalVideos > 0 && <span><b className="text-black dark:text-[#D5D5D5]">{totalVideos}</b> videos</span>}
                            {course.counts.questionCount > 0 && <span><b className="text-black dark:text-[#D5D5D5]">{course.counts.questionCount}</b> questions</span>}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2">
                            {actionItems.map((action) =>
                                action.external ? (
                                    <a
                                        key={action.label}
                                        href={action.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex h-9 items-center gap-1.5 border-2 border-[#5FC4E7] bg-[#5FC4E7]/40 px-3 text-sm font-semibold text-black transition hover:bg-[#5FC4E7]/60 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/15"
                                    >
                                        {action.label}
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </a>
                                ) : (
                                    <Link
                                        key={action.label}
                                        href={action.href}
                                        className="inline-flex h-9 items-center gap-1.5 border-2 border-[#5FC4E7] bg-[#5FC4E7]/40 px-3 text-sm font-semibold text-black transition hover:bg-[#5FC4E7]/60 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/15"
                                    >
                                        {action.label}
                                    </Link>
                                ),
                            )}
                        </div>
                    </div>

                    {/* Course image — clean, no text overlay */}
                    {course.image && (
                        <div className="relative w-full overflow-hidden border-2 border-[#5FC4E7] dark:border-[#ffffff]/20 lg:w-80">
                            <div className="aspect-[4/3]">
                                <AppImage
                                    src={course.image}
                                    alt={course.displayName}
                                    fill
                                    priority
                                    className="object-cover"
                                />
                            </div>
                            <div className="absolute right-2 top-2">
                                <ResourceBookmarkButton
                                    id={course.id}
                                    title={course.displayName}
                                    className="border-white/20 bg-black/40 text-white hover:bg-black/55 dark:border-white/20 dark:bg-black/45 dark:text-white"
                                />
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {/* Module journey */}
            <ModuleJourney modules={course.modules} />

            {/* Explorer */}
            <VinCourseExplorer course={course} sourceOrigin={meta.source.origin} />
        </div>
    );
}
