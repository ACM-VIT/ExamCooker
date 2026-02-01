import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import ModuleDropdown from "../../../components/ModuleDropdown";
import { notFound } from "next/navigation";
import ViewTracker from "@/app/components/ViewTracker";
import { buildKeywords, DEFAULT_KEYWORDS } from "@/lib/seo";

async function fetchSubject(id: string) {
    return prisma.subject.findUnique({
        where: {id},
        include: {modules: true},
    });
}

function parseSubjectName(name: string) {
    const [courseCode, ...rest] = name.split("-");
    const courseName = rest.join("-").trim() || "Subject Name";
    return { courseCode: courseCode?.trim() || "Course", courseName };
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const subject = await fetchSubject(id);
    if (!subject) return {};
    const { courseCode, courseName } = parseSubjectName(subject.name);
    const title = `${courseName} (${courseCode}) resources`;
    const description = `Browse ${courseName} resources and modules on ExamCooker.`;

    return {
        title,
        description,
        keywords: buildKeywords(DEFAULT_KEYWORDS, [courseCode, courseName]),
        alternates: { canonical: `/resources/${subject.id}` },
        openGraph: {
            title,
            description,
            url: `/resources/${subject.id}`,
        },
    };
}

export default async function SubjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const subject = await fetchSubject(id);
    //Since the Subject datatype only has a "name" field, I assume that the name has to be something like "COURSECODE - COURSENAME" and 
    //am hence, using the '-' character to split the string
    if (!subject) {
        return notFound();
    }
    const { courseCode, courseName } = parseSubjectName(subject.name);


    return (
        <div className="transition-colors container mx-auto p-2 sm:p-4 text-black dark:text-[#D5D5D5]">
            <ViewTracker
                id={subject.id}
                type="subject"
                title={subject.name}
            />
            <h2>{courseName}</h2>
            <br />
            <h3>Course Code: {courseCode}</h3>
            <br />
            <br />
            <div className="space-y-6">
                {subject.modules.map((module) => (
                    <ModuleDropdown key={module.id} module={module} />
                ))}
            </div>
        </div>
    );
}
