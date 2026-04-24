import {
    formatCountChip,
    OG_ALT,
    OG_CONTENT_TYPE,
    OG_IMAGE_SIZE,
    renderExamCookerOgImage,
} from "@/lib/og";
import { getCatalogStats } from "@/lib/data/courseCatalog";

export const runtime = "nodejs";
export const alt = OG_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
    const stats = await getCatalogStats();

    return renderExamCookerOgImage({
        eyebrow: "",
        title: "Cram like a Champ.",
        subtitle: "Past papers, notes, syllabus PDFs, and course resources in one place.",
        chips: [
            formatCountChip("courses", stats.courseCount),
            formatCountChip("papers", stats.paperCount),
            formatCountChip("notes", stats.noteCount),
        ],
    });
}
