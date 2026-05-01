import type { NextConfig } from "next";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

function getAzureBaseUrlFromEnv() {
    const explicitBaseUrl = process.env.AZURE_BLOB_PUBLIC_BASE_URL?.trim();
    if (explicitBaseUrl) {
        return explicitBaseUrl;
    }

    const container = process.env.AZURE_STORAGE_CONTAINER?.trim();
    if (!container) {
        return "";
    }

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
    if (connectionString) {
        const segments = new Map<string, string>();
        for (const part of connectionString.split(";")) {
            const trimmed = part.trim();
            if (!trimmed) {
                continue;
            }
            const separatorIndex = trimmed.indexOf("=");
            if (separatorIndex === -1) {
                continue;
            }
            const key = trimmed.slice(0, separatorIndex).trim();
            const value = trimmed.slice(separatorIndex + 1).trim();
            segments.set(key, value);
        }

        const blobEndpoint = segments.get("BlobEndpoint");
        if (blobEndpoint) {
            return `${blobEndpoint.replace(/\/+$/, "")}/${container}`;
        }

        const accountName = segments.get("AccountName");
        const endpointSuffix = segments.get("EndpointSuffix") || "core.windows.net";
        if (accountName) {
            return `https://${accountName}.blob.${endpointSuffix}/${container}`;
        }
    }

    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
    if (!accountName) {
        return "";
    }

    return `https://${accountName}.blob.core.windows.net/${container}`;
}

function buildRemotePattern(baseUrl: string): RemotePattern | null {
    if (!baseUrl) {
        return null;
    }

    try {
        const parsed = new URL(baseUrl);
        const protocol =
            parsed.protocol === "http:" || parsed.protocol === "https:"
                ? (parsed.protocol.replace(/:$/, "") as "http" | "https")
                : null;
        if (!protocol) {
            return null;
        }
        const pathnameBase = parsed.pathname.replace(/\/+$/, "");
        return {
            protocol,
            hostname: parsed.hostname,
            pathname: pathnameBase ? `${pathnameBase}/**` : "/**",
        };
    } catch {
        return null;
    }
}

const configuredAzureBaseUrl = getAzureBaseUrlFromEnv();

const fallbackAzureBaseUrls = [
    "https://examcookerdevsi.blob.core.windows.net/exam-assets",
    "https://examcookerprodsi.blob.core.windows.net/exam-assets",
];

const configuredRemotePatterns = Array.from(
    new Map(
        [configuredAzureBaseUrl, ...fallbackAzureBaseUrls]
            .map((baseUrl) => baseUrl.trim())
            .filter(Boolean)
            .map((baseUrl) => [baseUrl, buildRemotePattern(baseUrl)]),
    ).values(),
).filter((pattern): pattern is RemotePattern => pattern !== null);

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
            ...configuredRemotePatterns,
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
                source: `${normalizedProxyPath}/array/:path*`,
                destination: `${assetsHost}/array/:path*`,
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
