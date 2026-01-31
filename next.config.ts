import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
