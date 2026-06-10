import { normalizeCourseCode } from "@/lib/course-tags";
import { examSlugToType, examTypeLabel } from "@/lib/exam-slug";
import { getCourseDetailByCode } from "@/lib/data/course-catalog";
import { getCoursePapers } from "@/lib/data/course-papers";
import { getSyllabusByCourseCode } from "@/lib/data/syllabus";
import { formatCountChip, OG_ALT, OG_CONTENT_TYPE, OG_IMAGE_SIZE, renderExamCookerOgImage } from "@/lib/og";

export const runtime = "nodejs";
export const alt = OG_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
    params,
}: {
    params: Promise<{ code: string; exam: string }>;
}) {
    const { code, exam } = await params;
    const normalized = normalizeCourseCode(code);
    const examType = examSlugToType(exam);

    if (!normalized || !examType) {
        return renderExamCookerOgImage({
            eyebrow: "Exam Collection",
            title: "Past Papers",
            subtitle: "Course and exam-specific paper collections on ExamCooker.",
        });
    }

    const course = await getCourseDetailByCode(normalized);
    if (!course) {
        return renderExamCookerOgImage({
            eyebrow: "Exam Collection",
            title: normalized,
            subtitle: "Course and exam-specific paper collection on ExamCooker.",
        });
    }

    const [{ totalCount }, syllabus] = await Promise.all([
        getCoursePapers({
            courseId: course.id,
            filters: { examTypes: [examType] },
            sort: "year_desc",
            page: 1,
            pageSize: 1,
        }),
        getSyllabusByCourseCode(course.code),
    ]);

    const label = examTypeLabel(examType);

    return renderExamCookerOgImage({
        eyebrow: label,
        title: `${course.code} ${label}`,
        subtitle: course.title,
        description: "A focused collection for one exam pattern inside the course paper archive.",
        chips: [
            formatCountChip("papers", totalCount),
            formatCountChip("notes", course.noteCount),
            syllabus ? "Linked syllabus" : undefined,
        ],
    });
}
