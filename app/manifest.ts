import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
    const baseUrl = getBaseUrl();
    return {
        id: `${baseUrl}/`,
        name: "ExamCooker",
        short_name: "ExamCooker",
        description: "Cram up for your exams with ExamCooker!",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui", "browser"],
        background_color: "#C2E6EC",
        theme_color: "#5FC4E7",
        orientation: "portrait-primary",
        categories: ["education", "books", "productivity"],
        icons: [
            {
                src: "/assets/logo-icon.svg",
                sizes: "any",
                type: "image/svg+xml",
            },
            {
                src: "/icons/icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icons/icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "maskable",
            },
            {
                src: "/icons/icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icons/icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
        screenshots: [
            {
                src: "/opengraph-image.png",
                sizes: "1200x630",
                type: "image/png",
                form_factor: "wide",
            },
        ],
    };
}
