import { getExamHubPageData } from "@/lib/data/course-exams";
import { examSlugToType } from "@/lib/exam-slug";
import { formatCountChip, OG_ALT, OG_CONTENT_TYPE, OG_IMAGE_SIZE, renderExamCookerOgImage } from "@/lib/og";

export const runtime = "nodejs";
export const alt = OG_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
    params,
}: {
    params: Promise<{ exam: string }>;
}) {
    const { exam } = await params;
    const examType = examSlugToType(exam);

    if (!examType) {
        return renderExamCookerOgImage({
            eyebrow: "Exam Hub",
            title: "Past Papers",
            subtitle: "Exam-specific paper collections on ExamCooker.",
        });
    }

    const data = await getExamHubPageData(examType);
    if (!data) {
        return renderExamCookerOgImage({
            eyebrow: "Exam Hub",
            title: "Past Papers",
            subtitle: "Exam-specific paper collections on ExamCooker.",
        });
    }

    return renderExamCookerOgImage({
        eyebrow: "Exam Hub",
        title: `${data.label} Past Papers`,
        subtitle: "Browse course-wise collections for this exam type.",
        chips: [
            formatCountChip("papers", data.totalPapers),
            formatCountChip("courses", data.courseCount),
            data.latestYear ? `Latest ${data.latestYear}` : undefined,
        ],
    });
}
