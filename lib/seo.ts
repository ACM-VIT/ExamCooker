const FALLBACK_BASE_URL = "https://examcooker.acmvit.in";

export const DEFAULT_KEYWORDS = [
    "examcooker",
    "exam cooker",
    "vit",
    "vellore institute of technology",
    "vit vellore",
    "vit chennai",
    "vit acm",
    "acm vit",
    "vit question bank",
    "vit exam papers",
    "vit previous year papers",
    "vit pyq",
    "vit question papers pdf",
    "vit notes",
    "vit study material",
    "vit syllabus",
    "vit course materials",
    "vit assignments",
    "vit lab manuals",
    "vit solved papers",
    "vit sample papers",
    "vit mock tests",
    "previous year question papers",
    "question papers",
    "question bank",
    "past papers",
    "pyq",
    "pyq pdf",
    "previous year papers pdf",
    "exam papers pdf",
    "semester exam papers",
    "semester exam questions",
    "internal assessment papers",
    "mid sem papers",
    "end sem papers",
    "cat1 papers",
    "cat2 papers",
    "fat papers",
    "notes",
    "lecture notes",
    "class notes",
    "study notes",
    "revision notes",
    "course notes",
    "study resources",
    "study guide",
    "exam preparation",
    "exam prep",
    "exam revision",
    "exam practice",
    "practice questions",
    "question bank pdf",
    "download question papers",
    "acm vit",
    "acm vit resources",
    "engineering exam prep",
    "computer science notes",
    "cse notes",
    "ece notes",
    "eee notes",
    "mech notes",
    "it notes",
    "btech notes",
    "btech question papers",
    "btech previous year papers",
    "college exam papers",
    "university exam papers",
    "study material pdf",
];

export function getBaseUrl() {
    return (process.env.NEXT_PUBLIC_BASE_URL || FALLBACK_BASE_URL).replace(/\/$/, "");
}

export function absoluteUrl(path: string) {
    const baseUrl = getBaseUrl();
    if (!path) return baseUrl;
    return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function normalizeTitle(title: string) {
    return title.replace(/\.pdf$/i, "").trim();
}

export function safeDecodeURIComponent(value: string) {
    try {
        return decodeURIComponent(value).trim();
    } catch {
        return value.trim();
    }
}

export function safeEncodeURIComponent(value: string) {
    return encodeURIComponent(value.trim());
}

export function buildKeywords(primary: string[], secondary: string[] = []) {
    const normalized = new Set<string>();
    [...primary, ...secondary].forEach((keyword) => {
        const cleaned = keyword.trim();
        if (cleaned) normalized.add(cleaned);
    });
    return Array.from(normalized);
}
