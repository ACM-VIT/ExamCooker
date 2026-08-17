import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/auth";
import { getModeratorCourseRegistry } from "@/app/actions/manage-courses";
import CourseRegistry from "@/app/components/mod/course-registry";

export const metadata: Metadata = {
    title: "Course registry · Mod",
};

export const instant = true;

function CourseRegistryShell() {
    return (
        <div
            className="min-h-dvh bg-[#C2E6EC] px-3 py-6 dark:bg-[hsl(224,48%,9%)] sm:px-6 lg:px-10"
            aria-hidden
        >
            <div className="mx-auto w-full max-w-7xl animate-pulse">
                <div className="h-24 border-b-2 border-black/10 dark:border-white/10" />
                <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="min-h-32 bg-black/10 dark:bg-white/[0.06]" />
                    ))}
                </div>
                <div className="mt-8 grid items-start gap-3 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
                    <div className="h-[36rem] bg-black/10 dark:bg-white/[0.06]" />
                    <div className="h-[36rem] bg-black/10 dark:bg-white/[0.06]" />
                </div>
            </div>
        </div>
    );
}

async function ProtectedCourseRegistry() {
    const session = await auth();
    if (!session?.user) redirect("/");
    if (session.user.role !== "MODERATOR") notFound();

    const courses = await getModeratorCourseRegistry();
    return <CourseRegistry initialCourses={courses} />;
}

export default function ModeratorCoursesPage() {
    return (
        <Suspense fallback={<CourseRegistryShell />}>
            <ProtectedCourseRegistry />
        </Suspense>
    );
}
