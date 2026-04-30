import { getPastPaperDetail } from "@/lib/data/past-paper-detail";
import { examTypeLabel } from "@/lib/exam-slug";
import {
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
    params: Promise<{ code: string; id: string }>;
}) {
    const { id } = await params;
    const paper = await getPastPaperDetail(id);

    if (!paper) {
        return renderExamCookerOgImage({
            eyebrow: "Past Paper",
            title: "Past Paper",
            subtitle: "View previous year question papers on ExamCooker.",
        });
    }

    const courseCode = paper.course?.code;
    const courseTitle = paper.course?.title;
    const examType = paper.examType ? examTypeLabel(paper.examType) : undefined;
    const primaryTitle = [courseCode, examType].filter(Boolean).join(" ") || "Past Paper";

    return renderExamCookerOgImage({
        eyebrow: "Past Paper",
        title: primaryTitle,
        subtitle: courseTitle ?? primaryTitle,
        chips: [
            paper.slot ? `Slot ${paper.slot}` : undefined,
            paper.year?.toString(),
            "Question paper",
        ],
    });
}
