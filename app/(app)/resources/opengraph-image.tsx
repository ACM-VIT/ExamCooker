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

const RESOURCE_HUB_COUNT = 2;

export default async function Image() {
    return renderExamCookerOgImage({
        eyebrow: "Resource Repo",
        title: "Course Resources",
        subtitle: "Module links, reference material, and videos grouped by course.",
        chips: [
            formatCountChip("resource hubs", RESOURCE_HUB_COUNT),
            "Module-wise links",
            "Videos and references",
        ],
    });
}
