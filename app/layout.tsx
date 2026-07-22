import React, { Suspense } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/app/components/ui/toaster";
import "@/app/globals.css";
import UpsellToast from "@/app/components/ui/upsell-toast";
import UpsellModal from "@/app/components/ui/upsell-modal";
import PwaServiceWorker from "@/app/components/pwa-service-worker";
import HydrationRecovery from "@/app/hydration-recovery";
import {
    HYDRATION_RECOVERY_INCIDENT_KEY,
    RELOAD_FLAG,
    RELOAD_GUARD_TTL_MS,
} from "@/app/global-error-reload-guard";
import CapacitorBridge from "@/app/components/capacitor-bridge";
import NativeIosTabSync from "@/app/components/native-ios-tab-sync";
import AndroidInstallBanner from "@/app/components/android-install-banner";
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
    // Disable Safari/iOS Data Detectors entirely. When left on, Safari rewrites
    // matched text (dates, times, addresses, emails, phone numbers) into <a>
    // wrappers *before* React hydrates, which mutates the server-rendered DOM and
    // triggers a React #418 hydration mismatch — observed only on Safari/iOS as a
    // flash of the homepage and resource pages. Turning all detectors off keeps
    // the pre-hydration markup identical to what the server rendered.
    formatDetection: {
        telephone: false,
        date: false,
        address: false,
        email: false,
        url: false,
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

// React reports #418/#419 hydration mismatches as *recoverable* errors emitted
// *during* the initial hydration pass — before any React `useEffect` runs — so
// a listener attached from a client component would miss the very first blank
// or corrupted viewer of the session. Install the global `error` listener here,
// before hydration, so a mismatch is caught the moment it fires: perform the
// same guarded, one-time `location.reload()` recovery used for `ChunkLoadError`
// (reusing the same reload guard so it can't loop) and record the incident so
// `HydrationRecovery` can report it to PostHog once the page is stable. Kept as
// a string constant (not a regex) so no escaping is mangled when inlined. The
// numbers cover the recoverable hydration error codes React can emit.
const hydrationRecoveryInitScript = `(function(){try{var FLAG=${JSON.stringify(
    RELOAD_FLAG,
)},INC=${JSON.stringify(
    HYDRATION_RECOVERY_INCIDENT_KEY,
)},TTL=${RELOAD_GUARD_TTL_MS},NUMS={418:1,419:1,420:1,421:1,422:1,423:1,425:1},handled=false;function isHy(m){if(!m)return false;m=''+m;var l=m.toLowerCase();var i=m.indexOf('Minified React error #');if(i!==-1){var n='';for(var j=i+22;j<m.length;j++){var c=m.charCodeAt(j);if(c>=48&&c<=57){n+=m.charAt(j);}else{break;}}if(n&&NUMS[+n])return true;}return l.indexOf('hydrat')!==-1||l.indexOf('did not match')!==-1||l.indexOf('text content does not match')!==-1;}window.addEventListener('error',function(e){if(handled)return;var err=e&&e.error,msg=(err&&err.message)||(e&&e.message)||'';if(!isHy(msg))return;handled=true;var key='hydration:'+((err&&err.name)||'Error')+':'+msg+':'+((err&&err.digest)||''),reload=false;try{var raw=sessionStorage.getItem(FLAG),fresh=false;if(raw){var g=JSON.parse(raw);fresh=!!g&&g.key===key&&(Date.now()-g.timestamp)<TTL;}if(!fresh){sessionStorage.setItem(FLAG,JSON.stringify({key:key,timestamp:Date.now()}));reload=true;}}catch(_){}try{sessionStorage.setItem(INC,JSON.stringify({path:location.pathname+location.search,message:(''+msg).slice(0,500),reloadTriggered:reload}));}catch(_){}if(reload){location.reload();}});}catch(_){}})();`;

function GoogleAnalytics({ gaId }: { gaId: string }) {
    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(gaId)});`}
            </Script>
        </>
    );
}

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
            style={{ backgroundColor: "var(--ec-app-bg, #0C1222)" }}
        >
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link rel="preconnect" href="https://examcookerprodsi.blob.core.windows.net" crossOrigin="" />
                <link rel="preconnect" href="https://examcookerdevsi.blob.core.windows.net" crossOrigin="" />
                <link rel="dns-prefetch" href="https://i.ytimg.com" />
                <link rel="dns-prefetch" href="https://storage.googleapis.com" />
                <link rel="dns-prefetch" href="https://eu.i.posthog.com" />
                <link rel="dns-prefetch" href="https://us.i.posthog.com" />
                <StructuredData
                    data={[
                           buildOrganizationStructuredData(),
                        buildWebSiteStructuredData(),
                    ]}
                />
                <Script id="theme-init" strategy="beforeInteractive">
                    {"(function(){var r=document.documentElement;function m(q){return window.matchMedia&&window.matchMedia(q).matches;}function a(d){var bg=d?'#0C1222':'#C2E6EC';r.classList.toggle('dark',d);r.dataset.theme=d?'dark':'light';r.style.colorScheme=d?'dark':'light';r.style.setProperty('--ec-app-bg',bg);r.style.backgroundColor=bg;}try{var t=localStorage.getItem('theme');var mobile=m('(max-width: 767px), (pointer: coarse)');var d=t==='dark'||(t!=='light'&&(mobile?m('(prefers-color-scheme: dark)'):true));a(d);}catch(e){a(true);}})();"}
                </Script>
                <Script id="native-shell-init" strategy="beforeInteractive">
                    {"(function(){try{var c=window.Capacitor;if(!c||typeof c.isNativePlatform!=='function'||!c.isNativePlatform())return;var p=typeof c.getPlatform==='function'?c.getPlatform():'';if(p!=='ios'&&p!=='android')return;var r=document.documentElement;r.dataset.nativePlatform=p;r.toggleAttribute('data-native-ios',p==='ios');r.toggleAttribute('data-native-android',p==='android');r.setAttribute('data-native-tabs-pending','true');r.setAttribute(p==='ios'?'data-native-ios-tabs-pending':'data-native-android-tabs-pending','true');}catch(e){}})();"}
                </Script>
                <Script id="hydration-recovery-init" strategy="beforeInteractive">
                    {hydrationRecoveryInitScript}
                </Script>
            </head>
            <body
                className={`${plus_jakarta_sans.className} antialiased bg-[#C2E6EC] dark:bg-[#0C1222]`}
                style={{
                    margin: "0",
                    backgroundColor: "var(--ec-app-bg, #0C1222)",
                }}
            >
                <HydrationRecovery />
                {children}
                <Toaster />
                <Suspense fallback={null}>
                    <UpsellToast />
                </Suspense>
                <Suspense fallback={null}>
                    <UpsellModal />
                </Suspense>
                <Suspense fallback={null}>
                    <AndroidInstallBanner />
                </Suspense>
                <PwaServiceWorker />
                <CapacitorBridge />
                <Suspense fallback={null}>
                    <NativeIosTabSync />
                </Suspense>
                {process.env.GA_ID && (
                    <GoogleAnalytics gaId={process.env.GA_ID} />
                )}
            </body>
        </html>
    );
}
