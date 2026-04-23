import { normalizeCourseCode } from "@/lib/courseTags";
import { getCourseByCodeAny } from "@/lib/data/courses";
import { getCourseDetailByCode } from "@/lib/data/courseCatalog";
import { getCourseNotesCount } from "@/lib/data/notes";
import { getSubjectByCourseCode } from "@/lib/data/resources";
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
    const { code: rawCode } = await params;
    const normalized = normalizeCourseCode(rawCode);

    if (!normalized) {
        return renderExamCookerOgImage({
            eyebrow: "Course Hub",
            title: "ExamCooker Courses",
            subtitle: "Course pages with past papers, notes, syllabus, and resources.",
            chips: ["Course-wise navigation"],
        });
    }

    const [tagCourse, courseDetail] = await Promise.all([
        getCourseByCodeAny(normalized),
        getCourseDetailByCode(normalized),
    ]);

    if (!tagCourse && !courseDetail) {
        return renderExamCookerOgImage({
            eyebrow: "Course Hub",
            title: normalized,
            subtitle: "Course page on ExamCooker.",
        });
    }

    const courseCode = courseDetail?.code ?? tagCourse?.code ?? normalized;
    const courseTitle = courseDetail?.title ?? tagCourse?.title ?? normalized;
    const tagIds = tagCourse?.tagIds ?? [];

    const [noteCount, syllabus, subject] = await Promise.all([
        getCourseNotesCount({
            courseId: courseDetail?.id ?? null,
            tagIds,
        }),
        getSyllabusByCourseCode(courseCode),
        getSubjectByCourseCode(courseCode),
    ]);

    return renderExamCookerOgImage({
        eyebrow: "Course Hub",
        title: courseCode,
        subtitle: courseTitle,
        description: "Past papers, notes, syllabus, and study resources for this course.",
        chips: [
            formatCountChip("papers", courseDetail?.paperCount ?? 0),
            formatCountChip("notes", noteCount),
            syllabus || subject ? "Linked study resources" : undefined,
        ],
    });
}
