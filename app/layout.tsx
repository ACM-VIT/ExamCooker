import React, { Suspense } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/toaster";
import "@/app/globals.css";
import UpsellToast from "@/components/ui/UpsellToast";
import UpsellModal from "@/components/ui/UpsellModal";
import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata, Viewport } from "next";
import { DEFAULT_KEYWORDS, getBaseUrl } from "@/lib/seo";
import PostHogProvider from "@/app/posthog-provider";
import StructuredData from "@/app/components/seo/StructuredData";
import {
    buildOrganizationStructuredData,
    buildWebSiteStructuredData,
} from "@/lib/structuredData";

const baseUrl = getBaseUrl();

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
};

export const metadata: Metadata = {
    title: {
        template: "%s | ExamCooker",
        default: "ExamCooker - VIT Past Papers, Notes & Syllabus",
    },
    description:
        "ExamCooker helps VIT students find past papers, previous year question papers, notes, syllabus PDFs, and course resources in one place.",
    keywords: DEFAULT_KEYWORDS,
    metadataBase: new URL(baseUrl),
    alternates: {
        canonical: "/",
    },
    openGraph: {
        type: "website",
        url: baseUrl,
        siteName: "ExamCooker",
        title: "ExamCooker - VIT Past Papers, Notes & Syllabus",
        description:
            "Find VIT past papers, notes, syllabus PDFs, and study resources for every course on ExamCooker.",
        images: [{ url: `${baseUrl}/opengraph-image` }],
    },
    twitter: {
        card: "summary_large_image",
        title: "ExamCooker - VIT Past Papers, Notes & Syllabus",
        description:
            "Find VIT past papers, notes, syllabus PDFs, and study resources for every course on ExamCooker.",
        images: [`${baseUrl}/twitter-image`],
    },
};
const plus_jakarta_sans = Plus_Jakarta_Sans({ subsets: ["latin"] });

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
            <head>
                <StructuredData
                    data={[
                        buildOrganizationStructuredData(),
                        buildWebSiteStructuredData(),
                    ]}
                />
                <Script id="theme-init" strategy="beforeInteractive">
                    {"(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();"}
                </Script>
            </head>
            <body
                className={`${plus_jakarta_sans.className} antialiased bg-[#C2E6EC] dark:bg-[#0C1222]`}
                style={{ margin: "0" }}
            >
                <PostHogProvider>
                    <Suspense fallback={null}>{children}</Suspense>
                    <Toaster />
                    <UpsellToast />
                    <UpsellModal />
                    {process.env.GA_ID && (
                        <GoogleAnalytics gaId={process.env.GA_ID} />
                    )}
                </PostHogProvider>
            </body>
        </html>
    );
}
