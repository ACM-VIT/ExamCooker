import {
    formatCountChip,
    OG_ALT,
    OG_CONTENT_TYPE,
    OG_IMAGE_SIZE,
    renderExamCookerOgImage,
} from "@/lib/og";
import { getCatalogStats } from "@/lib/data/course-catalog";

export const runtime = "nodejs";
export const alt = OG_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
    const stats = await getCatalogStats();

    return renderExamCookerOgImage({
        eyebrow: "Previous Year Papers",
        title: "Past Papers",
        subtitle: "CAT-1, CAT-2, FAT, quiz, and course-wise question paper collections.",
        chips: [
            formatCountChip("papers", stats.paperCount),
            formatCountChip("courses", stats.courseCount),
            "Exam filters",
        ],
    });
}
