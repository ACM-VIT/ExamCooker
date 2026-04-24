import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    cacheComponents: true,
    experimental: {
        viewTransition: true,
    },
    reactCompiler: true,
    turbopack: {
        root: __dirname,
        resolveAlias: {
            canvas: {
                browser: "./lib/shims/canvas",
            },
        },
    },
    serverExternalPackages: ["canvas"],
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: "https",
                hostname: "storage.googleapis.com",
                pathname: "/**",
            },
            {
                protocol: "https",
                hostname: "www.everything-assistant.com",
                pathname: "/onboarding-artwork/**",
            },
        ],
    },
    async redirects() {
        return [
            { source: "/courses", destination: "/past_papers", permanent: true },
            { source: "/courses/:code", destination: "/past_papers/:code", permanent: true },
            {
                source: "/courses/:code/:exam",
                destination: "/past_papers/:code/:exam",
                permanent: true,
            },
        ];
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
    webpack(config, { dev, isServer }) {
        if (dev && !isServer) {
            config.devtool = "cheap-module-source-map";
        }

        return config;
    },
};

export default nextConfig;
