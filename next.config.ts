import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    cacheComponents: true,
    turbopack: {
        resolveAlias: {
            canvas: {
                browser: "./lib/shims/canvas",
            },
        },
    },
    serverExternalPackages: ["canvas"],
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "storage.googleapis.com",
                pathname: "/**",
            },
        ],
    },
    async rewrites() {
        const proxyPath =
            process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH?.trim() || "/ecp";
        const normalizedProxyPath = proxyPath.startsWith("/")
            ? proxyPath
            : `/${proxyPath}`;

        const posthogHost =
            process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
            "https://eu.i.posthog.com";
        const normalizedPosthogHost = posthogHost.replace(/\/$/, "");
        const isUsRegion = normalizedPosthogHost.includes("us.i.posthog.com");
        const isEuRegion = normalizedPosthogHost.includes("eu.i.posthog.com");
        const assetsHost = isUsRegion
            ? "https://us-assets.i.posthog.com"
            : isEuRegion
                ? "https://eu-assets.i.posthog.com"
                : normalizedPosthogHost;

        return [
            {
                source: `${normalizedProxyPath}/static/:path*`,
                destination: `${assetsHost}/static/:path*`,
            },
            {
                source: `${normalizedProxyPath}/:path*`,
                destination: `${normalizedPosthogHost}/:path*`,
            },
        ];
    },
};

export default nextConfig;
