import {
    formatCountChip,
    OG_ALT,
    OG_CONTENT_TYPE,
    OG_IMAGE_SIZE,
    renderExamCookerOgImage,
} from "@/lib/og";
import { getCatalogStats } from "@/lib/data/courseCatalog";
import { getNotesCount } from "@/lib/data/notes";

export const runtime = "nodejs";
export const alt = OG_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
    const [stats, noteCount] = await Promise.all([
        getCatalogStats(),
        getNotesCount({ search: "", tags: [] }),
    ]);

    return renderExamCookerOgImage({
        eyebrow: "Study Material",
        title: "Course Notes",
        subtitle: "VIT notes, lecture notes, and revision material on ExamCooker.",
        chips: [
            formatCountChip("notes", noteCount),
            formatCountChip("courses", stats.courseCount),
            "PDF study material",
        ],
    });
}
