import { normalizeCourseCode } from "@/lib/course-tags";
import { getCourseDetailByCode } from "@/lib/data/course-catalog";
import { getSyllabusByCourseCode } from "@/lib/data/syllabus";
import {
    formatCountChip,
    OG_ALT,
    OG_CONTENT_TYPE,
    OG_IMAGE_SIZE,
    renderExamCookerOgImage,
} from "@/lib/og";

export const runtime = "nodejs";
export const alt = OG_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
    params,
}: {
    params: Promise<{ code: string }>;
}) {
    const { code } = await params;
    const normalized = normalizeCourseCode(code);

    if (!normalized) {
        return renderExamCookerOgImage({
            eyebrow: "Past Papers",
            title: "Past Papers",
            subtitle: "Course-wise paper collections on ExamCooker.",
        });
    }

    const course = await getCourseDetailByCode(normalized);
    if (!course) {
        return renderExamCookerOgImage({
            eyebrow: "Past Papers",
            title: normalized,
            subtitle: "Course-wise paper collection on ExamCooker.",
        });
    }

    const syllabus = await getSyllabusByCourseCode(course.code);

    return renderExamCookerOgImage({
        eyebrow: "Past Papers",
        title: `${course.code} Past Papers`,
        subtitle: course.title,
        description: "Browse previous year question papers and filter by exam type, year, slot, and more.",
        chips: [
            formatCountChip("papers", course.paperCount),
            formatCountChip("notes", course.noteCount),
            syllabus ? "Linked syllabus" : undefined,
        ],
    });
}
