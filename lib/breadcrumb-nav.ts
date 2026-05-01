export type BreadcrumbNavItem = {
    label: string;
    href?: string;
};

function formatSlug(seg: string): string {
    try {
        return decodeURIComponent(seg).replace(/-/g, " ");
    } catch {
        return seg;
    }
}

export function normalizeRouteKey(pathWithSearch: string): string {
    const [rawPath, query] = pathWithSearch.split("?");
    const path =
        rawPath.length > 1 && rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;
    return query ? `${path}?${query}` : path;
}

export function describePathForBreadcrumb(fullPath: string): { label: string; href: string } {
    const [pathPart, queryPart] = fullPath.split("?");
    const query = queryPart ? `?${queryPart}` : "";
    const href = `${pathPart}${query}`;
    const segments = pathPart.split("/").filter(Boolean);

    if (segments.length === 0) {
        return { label: "Home", href: "/" };
    }

    const a = segments[0];
    const b = segments[1];
    const c = segments[2];
    const d = segments[3];

    if (a === "past_papers") {
        if (!b) return { label: "Past papers", href };
        if (b === "create") return { label: "Past papers · Upload", href };
        if (b === "exam" && c) return { label: `Past papers · ${formatSlug(c)}`, href };
        if (c === "paper" && d) return { label: `${b} · Paper`, href };
        if (c === "exam" && d) return { label: `${b} · ${formatSlug(d)}`, href };
        return { label: `${b} · Past papers`, href };
    }

    if (a === "notes") {
        if (!b) return { label: "Notes", href };
        const isLikelyCourseCode =
            /^[A-Za-z]{2,}\d{2,}[A-Za-z0-9]*$/i.test(b) && b.length <= 14;
        if (isLikelyCourseCode) return { label: `Notes · ${b}`, href };
        return { label: "Notes · Document", href };
    }

    if (a === "syllabus") {
        if (!b) return { label: "Syllabus", href };
        if (b === "course" && c) return { label: `Syllabus · ${c}`, href };
        return { label: "Syllabus · Document", href };
    }

    if (a === "resources") {
        if (!b) return { label: "Resources", href };
        if (b === "course" && c) return { label: `Resources · ${c}`, href };
        return { label: "Resources · View", href };
    }

    if (a === "quiz") {
        return { label: "Quiz", href };
    }

    const last = segments[segments.length - 1] ?? "Page";
    return { label: formatSlug(last), href };
}

export function mergePrevCrumb(
    prev: { label: string; href: string } | null,
    items: BreadcrumbNavItem[],
    currentRouteKey: string,
): BreadcrumbNavItem[] {
    if (!prev) return items;
    const prevKey = normalizeRouteKey(prev.href);
    if (prevKey === normalizeRouteKey(currentRouteKey)) return items;
    if (items.some((i) => i.href !== undefined && normalizeRouteKey(i.href) === prevKey)) {
        return items;
    }
    return [{ label: prev.label, href: prev.href }, ...items];
}
