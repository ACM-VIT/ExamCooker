import { extractCourseFromTag } from "@/lib/courseTags";
import { getNoteDetail } from "@/lib/data/noteDetail";
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

function removePdfExtension(filename: string) {
    return filename.endsWith(".pdf") ? filename.slice(0, -4) : filename;
}

function isValidSlot(value: string) {
    return /^[A-G]\d$/i.test(value);
}

function isValidYear(value: string) {
    return /^20\d{2}$/.test(value);
}

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

    const cleanTitle = removePdfExtension(note.title);
    const courseInfo = note.tags.map((tag) => extractCourseFromTag(tag.name)).find(Boolean) ?? null;
    const slot = note.tags.find((tag) => isValidSlot(tag.name))?.name?.toUpperCase();
    const year = note.tags.find((tag) => isValidYear(tag.name))?.name;

    return renderExamCookerOgImage({
        eyebrow: "Study Notes",
        title: courseInfo ? `${courseInfo.code} Notes` : cleanTitle,
        subtitle: courseInfo ? courseInfo.title : "Study notes on ExamCooker.",
        description: courseInfo ? cleanTitle : undefined,
        chips: [
            slot ? `Slot ${slot}` : undefined,
            year,
            "PDF note",
        ],
    });
}
