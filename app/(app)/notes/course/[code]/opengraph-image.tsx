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
            eyebrow: "Course Notes",
            title: "Course Notes",
            subtitle: "Lecture notes, revision PDFs, and study material on ExamCooker.",
        });
    }

    const [tagCourse, courseDetail] = await Promise.all([
        getCourseByCodeAny(normalized),
        getCourseDetailByCode(normalized),
    ]);

    if (!tagCourse && !courseDetail) {
        return renderExamCookerOgImage({
            eyebrow: "Course Notes",
            title: normalized,
            subtitle: "Course notes on ExamCooker.",
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
        eyebrow: "Course Notes",
        title: `${courseCode} Notes`,
        subtitle: courseTitle,
        description: "Lecture notes, study material, and revision PDFs for this course.",
        chips: [
            formatCountChip("notes", noteCount),
            formatCountChip("papers", courseDetail?.paperCount ?? 0),
            syllabus || subject ? "Syllabus and resources" : undefined,
        ],
    });
}
