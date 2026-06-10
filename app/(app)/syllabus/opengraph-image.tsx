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

const SYLLABUS_COUNT = 552;

export default async function Image() {
    return renderExamCookerOgImage({
        eyebrow: "Syllabus PDFs",
        title: "Syllabus",
        subtitle: "Course-wise syllabus PDFs on ExamCooker.",
        chips: [
            formatCountChip("syllabi", SYLLABUS_COUNT),
            "Indexable course routes",
            "PDF viewer",
        ],
    });
}
