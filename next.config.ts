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
        domains: ["storage.googleapis.com"],
    },
};

export default nextConfig;
