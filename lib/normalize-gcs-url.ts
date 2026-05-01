const CACHE_BUST_BUCKETS = new Set([
    "examcooker-dev-media-20260423",
]);

const CACHE_BUST_VERSION =
    process.env.GCS_URL_CACHE_BUST?.trim() || "cors-20260423";

function parseGcsObjectUrl(url: string) {
    const parsed = new URL(url);

    if (parsed.hostname === "storage.googleapis.com") {
        const [bucket, ...rest] = parsed.pathname.replace(/^\/+/, "").split("/");
        if (!bucket || rest.length === 0) return null;
        return {
            parsed,
            bucket,
            objectPath: rest.join("/"),
        };
    }

    if (parsed.hostname.endsWith(".storage.googleapis.com")) {
        const bucket = parsed.hostname.replace(/\.storage\.googleapis\.com$/, "");
        const objectPath = parsed.pathname.replace(/^\/+/, "");
        if (!bucket || !objectPath) return null;
        return {
            parsed,
            bucket,
            objectPath,
        };
    }

    return null;
}

export function normalizeGcsUrl(url: string | null | undefined): string | null | undefined {
    if (!url) return url;
    try {
        const gcs = parseGcsObjectUrl(url);
        if (!gcs) return url;

        const normalized = new URL(
            `https://storage.googleapis.com/${gcs.bucket}/${gcs.objectPath}`,
        );

        for (const [key, value] of gcs.parsed.searchParams.entries()) {
            normalized.searchParams.append(key, value);
        }

        if (
            CACHE_BUST_BUCKETS.has(gcs.bucket) &&
            !normalized.searchParams.has("v")
        ) {
            normalized.searchParams.set("v", CACHE_BUST_VERSION);
        }

        return normalized.toString();
    } catch {
        return url;
    }
}
