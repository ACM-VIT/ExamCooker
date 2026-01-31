import React, { Suspense } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "@/app/globals.css";
import SocialMediaFollowToast from "@/components/ui/SocialMediaToast";
import { GoogleAnalytics } from "@next/third-parties/google";
import RouteGate from "@/app/components/RouteGate";

export const metadata = {
    title: {
        template: "%s | ExamCooker",
        default: "ExamCooker - ACM-VIT",
    },
    description: "Cram up for your exams with ExamCooker!! ",
    keywords: [
        "vit",
        "previous year question papers",
        "pdf",
        "notes",
        "question papers",
        "exam",
        "examcooker",
        "acm",
        "vit acm",
        "vit acm examcooker",
    ],
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL!),
    openGraph: {
        images: [
            { url: `${process.env.NEXT_PUBLIC_BASE_URL!}/opengraph-image.png` },
        ],
    },
};
const plus_jakarta_sans = Plus_Jakarta_Sans({ subsets: ["latin"] });

export default async function RootLayout({
    protected_routes,
    unprotected_routes,
}: {
    protected_routes: React.ReactNode;
    unprotected_routes: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body
                className={`${plus_jakarta_sans.className} antialiased bg-[#C2E6EC] dark:bg-[#0C1222]`}
                style={{ margin: "0" }}
            >
                <Suspense fallback={null}>
                    <RouteGate
                        isAuthed={false}
                        protectedRoutes={
                            <Suspense fallback={null}>
                                {protected_routes}
                            </Suspense>
                        }
                        unprotectedRoutes={unprotected_routes}
                    />
                </Suspense>
                <Toaster />
                <SocialMediaFollowToast />
                {process.env.GA_ID && (
                    <GoogleAnalytics gaId={process.env.GA_ID }/>
                )}
            </body>
        </html>
    );
}
