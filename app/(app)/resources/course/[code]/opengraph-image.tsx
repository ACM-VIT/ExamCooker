import { getCourseByCodeAny } from "@/lib/data/courses";
import { getCourseDetailByCode } from "@/lib/data/courseCatalog";
import { getSubjectByCourseCode } from "@/lib/data/resources";
import { getSyllabusByCourseCode } from "@/lib/data/syllabus";
import { normalizeCourseCode } from "@/lib/courseTags";
import { formatCountChip, OG_ALT, OG_CONTENT_TYPE, OG_IMAGE_SIZE, renderExamCookerOgImage } from "@/lib/og";
import { parseSubjectName } from "@/lib/seo";

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
            eyebrow: "Course Resources",
            title: "Course Resources",
            subtitle: "Module links, references, and videos on ExamCooker.",
        });
    }

    const [subject, courseDetail, tagCourse, syllabus] = await Promise.all([
        getSubjectByCourseCode(normalized),
        getCourseDetailByCode(normalized),
        getCourseByCodeAny(normalized),
        getSyllabusByCourseCode(normalized),
    ]);

    if (!subject) {
        return renderExamCookerOgImage({
            eyebrow: "Course Resources",
            title: normalized,
            subtitle: "Course resources on ExamCooker.",
        });
    }

    const parsed = parseSubjectName(subject.name);
    const courseCode = courseDetail?.code ?? tagCourse?.code ?? parsed.courseCode ?? normalized;
    const courseTitle = courseDetail?.title ?? tagCourse?.title ?? parsed.courseName ?? normalized;

    return renderExamCookerOgImage({
        eyebrow: "Course Resources",
        title: `${courseCode} Resources`,
        subtitle: courseTitle,
        description: "Module-wise links, references, and supporting videos for this course.",
        chips: [
            formatCountChip("modules", subject.modules.length),
            formatCountChip("papers", courseDetail?.paperCount ?? 0),
            syllabus ? "Linked syllabus" : undefined,
        ],
    });
}
