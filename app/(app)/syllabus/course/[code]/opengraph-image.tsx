import { getCourseByCodeAny } from "@/lib/data/courses";
import { getCourseDetailByCode } from "@/lib/data/courseCatalog";
import { getSubjectByCourseCode } from "@/lib/data/resources";
import { getSyllabusDetailByCourseCode } from "@/lib/data/syllabus";
import { normalizeCourseCode } from "@/lib/courseTags";
import { formatCountChip, OG_ALT, OG_CONTENT_TYPE, OG_IMAGE_SIZE, renderExamCookerOgImage } from "@/lib/og";
import { formatSyllabusDisplayName } from "@/lib/seo";

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
            eyebrow: "Syllabus PDF",
            title: "Course Syllabus",
            subtitle: "Course-wise syllabus PDFs on ExamCooker.",
        });
    }

    const [courseDetail, tagCourse, syllabus, subject] = await Promise.all([
        getCourseDetailByCode(normalized),
        getCourseByCodeAny(normalized),
        getSyllabusDetailByCourseCode(normalized),
        getSubjectByCourseCode(normalized),
    ]);

    if (!syllabus) {
        return renderExamCookerOgImage({
            eyebrow: "Syllabus PDF",
            title: normalized,
            subtitle: "Syllabus page on ExamCooker.",
        });
    }

    const courseCode = courseDetail?.code ?? tagCourse?.code ?? normalized;
    const courseTitle =
        courseDetail?.title ??
        tagCourse?.title ??
        formatSyllabusDisplayName(syllabus.name);

    return renderExamCookerOgImage({
        eyebrow: "Syllabus PDF",
        title: `${courseCode} Syllabus`,
        subtitle: courseTitle,
        description: "Open the syllabus PDF and jump to related notes, papers, and resources.",
        chips: [
            formatCountChip("papers", courseDetail?.paperCount ?? 0),
            formatCountChip("notes", courseDetail?.noteCount ?? 0),
            subject ? "Linked resources" : undefined,
        ],
    });
}
