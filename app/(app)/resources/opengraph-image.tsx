import {
    formatCountChip,
    OG_ALT,
    OG_CONTENT_TYPE,
    OG_IMAGE_SIZE,
    renderExamCookerOgImage,
} from "@/lib/og";
import { getResourcesCount } from "@/lib/data/resources";

export const runtime = "nodejs";
export const alt = OG_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
    const resourceCount = await getResourcesCount({ search: "" });

    return renderExamCookerOgImage({
        eyebrow: "Resource Repo",
        title: "Course Resources",
        subtitle: "Module links, reference material, and videos grouped by course.",
        chips: [
            formatCountChip("resource hubs", resourceCount),
            "Module-wise links",
            "Videos and references",
        ],
    });
}
