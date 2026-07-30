// Maps a concrete request path onto its Next.js route template so a per-resource
// identifier (a note/paper CUID, an encoded course code, …) never survives into
// an exception message — and therefore never into the Error Tracking
// fingerprint. Baking the raw path into `error.message` was fragmenting one
// hydration-recovery bug into a fresh Error Tracking issue for every newly
// visited resource; collapsing to the template keeps the message stable.
//
// Templates are listed most-specific first (more static segments = higher
// priority) so ambiguous shapes like `/past_papers/exam/theory` resolve to the
// route with the matching static segment rather than a same-length sibling.
const ROUTE_TEMPLATES: readonly (readonly string[])[] = [
    ["notes", "course", ":code"],
    ["notes", ":id"],
    ["past_papers", "exam", ":exam"],
    ["past_papers", ":code", "paper", ":id"],
    ["past_papers", ":code", ":exam"],
    ["past_papers", ":code"],
    ["syllabus", "course", ":code"],
    ["syllabus", ":id"],
    ["resources", "course", ":code"],
    ["resources", ":id"],
    ["native-auth", "start", ":provider"],
    ["native-auth", "browser-complete"],
    ["native-auth", "complete"],
    ["native-auth", "start"],
    ["sitemaps", ":collection"],
];

// A path segment is treated as a per-resource identifier (and collapsed to
// `[id]`) when it is percent-encoded, all digits, or a long opaque token such as
// a CUID. Short human-readable segments (`auth`, `past_papers`, …) are kept so
// static routes stay legible.
function normalizeSegment(segment: string): string {
    if (!segment) return segment;
    if (segment.includes("%")) return "[id]";
    if (/^\d+$/.test(segment)) return "[id]";
    if (segment.length >= 16 && /^[a-z0-9]+$/i.test(segment)) return "[id]";
    return segment;
}

/**
 * Normalize a pathname to its route template, e.g.
 * `/notes/clz19jxuv000ez14te8ntkgxz` -> `/notes/[id]`.
 *
 * Query strings and fragments are stripped first. Known dynamic routes resolve
 * to their declared template; anything unmatched falls back to a per-segment
 * heuristic so unknown routes still keep concrete IDs out of the result.
 */
export function toRouteTemplate(path: string): string {
    const clean = path.split(/[?#]/, 1)[0] || "/";
    const segments = clean.split("/").filter(Boolean);
    if (segments.length === 0) return "/";

    let best: { template: readonly string[]; statics: number } | null = null;
    for (const template of ROUTE_TEMPLATES) {
        if (template.length !== segments.length) continue;

        let statics = 0;
        let matches = true;
        for (let i = 0; i < template.length; i++) {
            const part = template[i];
            if (part.startsWith(":")) continue;
            if (part !== segments[i]) {
                matches = false;
                break;
            }
            statics += 1;
        }

        if (matches && (best === null || statics > best.statics)) {
            best = { template, statics };
        }
    }

    if (best) {
        return (
            "/" +
            best.template
                .map((part) =>
                    part.startsWith(":") ? `[${part.slice(1)}]` : part,
                )
                .join("/")
        );
    }

    return "/" + segments.map(normalizeSegment).join("/");
}
