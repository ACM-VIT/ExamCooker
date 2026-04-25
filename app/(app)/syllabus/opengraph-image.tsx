import {
    formatCountChip,
    OG_ALT,
    OG_CONTENT_TYPE,
    OG_IMAGE_SIZE,
    renderExamCookerOgImage,
} from "@/lib/og";
import { getSyllabusCount } from "@/lib/data/syllabus";

export const runtime = "nodejs";
export const alt = OG_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
    const syllabusCount = await getSyllabusCount({ search: "" });

    return renderExamCookerOgImage({
        eyebrow: "Syllabus PDFs",
        title: "Syllabus",
        subtitle: "Course-wise syllabus PDFs on ExamCooker.",
        chips: [
            formatCountChip("syllabi", syllabusCount),
            "Indexable course routes",
            "PDF viewer",
        ],
    });
}
