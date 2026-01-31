export function normalizeGcsUrl(url: string | null | undefined): string | null | undefined {
    if (!url) return url;
    try {
        const parsed = new URL(url);
        if (parsed.hostname === "storage.googleapis.com" && parsed.pathname.startsWith("/examcooker/")) {
            return `${parsed.origin}${parsed.pathname}`;
        }
        return url;
    } catch {
        return url;
    }
}
