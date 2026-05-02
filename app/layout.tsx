import React, { Suspense } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/app/components/ui/toaster";
import "@/app/globals.css";
import UpsellToast from "@/app/components/ui/upsell-toast";
import UpsellModal from "@/app/components/ui/upsell-modal";
import PwaServiceWorker from "@/app/components/pwa-service-worker";
import CapacitorBridge from "@/app/components/capacitor-bridge";
import PostHogBootstrap from "@/app/components/post-hog-bootstrap";
import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata, Viewport } from "next";
import { DEFAULT_KEYWORDS, getBaseUrl } from "@/lib/seo";
import StructuredData from "@/app/components/seo/structured-data";
import {
    buildOrganizationStructuredData,
    buildWebSiteStructuredData,
} from "@/lib/structured-data";

const baseUrl = getBaseUrl();

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: [
        { media: "(prefers-color-scheme: dark)", color: "#0C1222" },
        { media: "(prefers-color-scheme: light)", color: "#C2E6EC" },
    ],
};

export const metadata: Metadata = {
    title: {
        template: "%s | ExamCooker",
        default: "ExamCooker - Past Papers, Notes & Syllabus",
    },
    description:
        "ExamCooker helps students find past papers, previous year question papers, notes, syllabus PDFs, and course resources in one place.",
    keywords: DEFAULT_KEYWORDS,
    metadataBase: new URL(baseUrl),
    applicationName: "ExamCooker",
    appleWebApp: {
        capable: true,
        title: "ExamCooker",
        statusBarStyle: "black-translucent",
    },
    formatDetection: {
        telephone: false,
    },
    icons: {
        icon: [
            { url: "/assets/logo-icon.svg", type: "image/svg+xml" },
            { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
    openGraph: {
        type: "website",
        url: baseUrl,
        siteName: "ExamCooker",
        title: "ExamCooker - Past Papers, Notes & Syllabus",
        description:
            "Find past papers, notes, syllabus PDFs, and study resources for every course on ExamCooker.",
        images: [{ url: `${baseUrl}/opengraph-image` }],
    },
    twitter: {
        card: "summary_large_image",
        title: "ExamCooker - Past Papers, Notes & Syllabus",
        description:
            "Find past papers, notes, syllabus PDFs, and study resources for every course on ExamCooker.",
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
        <html
            lang="en"
            className="dark"
            suppressHydrationWarning
            data-scroll-behavior="smooth"
        >
            <head>
                <StructuredData
                    data={[
                           buildOrganizationStructuredData(),
                        buildWebSiteStructuredData(),
                    ]}
                />
                <Script id="theme-init" strategy="beforeInteractive">
                    {"(function(){var r=document.documentElement;function m(q){return window.matchMedia&&window.matchMedia(q).matches;}function a(d){r.classList.toggle('dark',d);r.dataset.theme=d?'dark':'light';r.style.colorScheme=d?'dark':'light';}try{var t=localStorage.getItem('theme');var mobile=m('(max-width: 767px), (pointer: coarse)');var d=t==='dark'||(t!=='light'&&(mobile?m('(prefers-color-scheme: dark)'):true));a(d);}catch(e){a(true);}})();"}
                </Script>
            </head>
            <body
                className={`${plus_jakarta_sans.className} antialiased bg-[#C2E6EC] dark:bg-[#0C1222]`}
                style={{ margin: "0" }}
            >
                <PostHogBootstrap />
                {children}
                <Toaster />
                <Suspense fallback={null}>
                    <UpsellToast />
                </Suspense>
                <Suspense fallback={null}>
                    <UpsellModal />
                </Suspense>
                <PwaServiceWorker />
                <CapacitorBridge />
                {process.env.GA_ID && (
                    <GoogleAnalytics gaId={process.env.GA_ID} />
                )}
            </body>
        </html>
    );
}
