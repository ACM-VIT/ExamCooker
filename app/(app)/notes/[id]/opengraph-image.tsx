import { getNoteDetail } from "@/lib/data/noteDetail";
import {
    OG_ALT,
    OG_CONTENT_TYPE,
    OG_IMAGE_SIZE,
    renderExamCookerOgImage,
} from "@/lib/og";
import { stripPdfExtension } from "@/lib/pdf";

export const runtime = "nodejs";
export const alt = OG_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const note = await getNoteDetail(id);

    if (!note) {
        return renderExamCookerOgImage({
            eyebrow: "Study Notes",
            title: "Course Notes",
            subtitle: "Study notes on ExamCooker.",
        });
    }

    const cleanTitle = stripPdfExtension(note.title);
    const courseCode = note.course?.code;
    const courseTitle = note.course?.title;

    return renderExamCookerOgImage({
        eyebrow: "Study Notes",
        title: courseCode ? `${courseCode} Notes` : cleanTitle,
        subtitle: courseTitle ?? "Study notes on ExamCooker.",
        description: courseCode ? cleanTitle : undefined,
        chips: ["PDF note"],
    });
}
