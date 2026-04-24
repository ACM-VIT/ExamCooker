import { normalizeCourseCode } from "@/lib/courseTags";
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

    const courseDetail = await getCourseDetailByCode(normalized);
    if (!courseDetail) {
        return renderExamCookerOgImage({
            eyebrow: "Course Notes",
            title: normalized,
            subtitle: "Course notes on ExamCooker.",
        });
    }

    const [noteCount, syllabus, subject] = await Promise.all([
        getCourseNotesCount({ courseId: courseDetail.id }),
        getSyllabusByCourseCode(courseDetail.code),
        getSubjectByCourseCode(courseDetail.code),
    ]);

    return renderExamCookerOgImage({
        eyebrow: "Course Notes",
        title: `${courseDetail.code} Notes`,
        subtitle: courseDetail.title,
        description: "Lecture notes, study material, and revision PDFs for this course.",
        chips: [
            formatCountChip("notes", noteCount),
            formatCountChip("papers", courseDetail.paperCount),
            syllabus || subject ? "Syllabus and resources" : undefined,
        ],
    });
}
