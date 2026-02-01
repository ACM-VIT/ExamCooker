import React, { Suspense } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "@/app/globals.css";
import SocialMediaFollowToast from "@/components/ui/SocialMediaToast";
import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata } from "next";
import { DEFAULT_KEYWORDS, getBaseUrl } from "@/lib/seo";
import PostHogProvider from "@/app/posthog-provider";

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
    title: {
        template: "%s | ExamCooker",
        default: "ExamCooker - ACM-VIT",
    },
    description: "Cram up for your exams with ExamCooker.",
    keywords: DEFAULT_KEYWORDS,
    metadataBase: new URL(baseUrl),
    alternates: {
        canonical: "/",
    },
    openGraph: {
        type: "website",
        url: baseUrl,
        siteName: "ExamCooker",
        title: "ExamCooker - ACM-VIT",
        description: "Cram up for your exams with ExamCooker.",
        images: [{ url: `${baseUrl}/opengraph-image.png` }],
    },
    twitter: {
        card: "summary_large_image",
        title: "ExamCooker - ACM-VIT",
        description: "Cram up for your exams with ExamCooker.",
        images: [`${baseUrl}/opengraph-image.png`],
    },
};
const plus_jakarta_sans = Plus_Jakarta_Sans({ subsets: ["latin"] });

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body
                className={`${plus_jakarta_sans.className} antialiased bg-[#C2E6EC] dark:bg-[#0C1222]`}
                style={{ margin: "0" }}
            >
                <PostHogProvider>
                    <Suspense fallback={null}>{children}</Suspense>
                    <Toaster />
                    <SocialMediaFollowToast />
                    {process.env.GA_ID && (
                        <GoogleAnalytics gaId={process.env.GA_ID} />
                    )}
                </PostHogProvider>
            </body>
        </html>
    );
}
