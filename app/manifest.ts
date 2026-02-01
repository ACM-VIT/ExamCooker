import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "ExamCooker",
        short_name: "ExamCooker",
        description: "Cram up for your exams with ExamCooker!",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#C2E6EC",
        theme_color: "#5FC4E7",
        icons: [
            {
                src: "/assets/LogoIcon.svg",
                sizes: "any",
                type: "image/svg+xml",
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
