import Fuse, { type FuseResult, type IFuseOptions } from "fuse.js";

/**
 * Minimal shape a record needs to be fuzzy-searchable as a course. Both the
 * server-side index (`getCourseSearchIndex`) and the client-side dropdowns feed
 * records that satisfy this, so the matching behaviour stays identical wherever
 * course search happens.
 */
export type CourseFuseRecord = {
    code: string;
    title: string;
    aliases?: string[];
};

/**
 * Shared Fuse.js configuration for course search. Kept in one client-safe place
 * so the homepage dropdown, the command palette / voice index, and the notes /
 * past-papers grids all fuzzy-match with the same weights and threshold.
 *
 * NOTE: this config is applied per *token*, not to the whole query — see
 * `CourseSearcher` below. Matching the entire query as one pattern (the previous
 * behaviour) meant a strong word plus a weak one ("forensic science") blew past
 * the threshold and collapsed to zero results, even though "forensic" alone is a
 * near-exact hit on "Digital Forensics". `minMatchCharLength` is 2 so two-letter
 * tokens still reach Fuse; single 1–2 character queries take the substring path.
 */
export const COURSE_SEARCH_FUSE_OPTIONS: IFuseOptions<CourseFuseRecord> = {
    keys: [
        { name: "title", weight: 0.6 },
        { name: "code", weight: 0.3 },
        { name: "aliases", weight: 0.1 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
    minMatchCharLength: 2,
    includeScore: true,
};

/** Split a query into search tokens, dropping punctuation ("b.sc" -> b, sc). */
const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u;

/** Shortest single query that still goes through Fuse rather than substring. */
const MIN_FUZZY_QUERY_LENGTH = 3;

export type CourseSearchResult<T extends CourseFuseRecord> = Pick<
    FuseResult<T>,
    "item" | "refIndex" | "score"
>;

export type CourseSearchOptions = {
    limit?: number;
};

/**
 * Wraps Fuse with per-token coverage ranking plus a substring fallback.
 *
 * Ranking is coverage-first: a course that matches more of the query's tokens
 * ranks above one that matches fewer, and average per-token Fuse score breaks
 * ties. This keeps a result alive when only some words match — "forensic
 * science" still surfaces "Digital Forensics" on the strength of "forensic"
 * instead of collapsing to nothing because "science" is pure error against that
 * title — without demanding that every token match (a strict token-AND would
 * drop that case too, since no title contains both words).
 *
 * The substring fallback handles the short-prefix regression: Fuse never
 * matches 1–2 character queries usefully, so "mu" -> "Multivariable Calculus"
 * needs a plain title/code/alias `includes` check.
 */
class CourseSearcher<T extends CourseFuseRecord> {
    private readonly fuse: Fuse<T>;

    constructor(private readonly records: T[]) {
        this.fuse = new Fuse(records, COURSE_SEARCH_FUSE_OPTIONS);
    }

    search(query: string, options?: CourseSearchOptions): CourseSearchResult<T>[] {
        const trimmed = query.trim();
        if (!trimmed) return [];
        const limit = options?.limit ?? this.records.length;

        const tokens = trimmed.split(TOKEN_SPLIT).filter(Boolean);
        const fuzzyTokens = tokens.filter((token) => token.length >= 2);

        // 1–2 character queries (and anything Fuse can't tokenise) never fuzzy
        // match; a substring pass is the only thing that surfaces short prefixes.
        if (fuzzyTokens.length === 0 || trimmed.length < MIN_FUZZY_QUERY_LENGTH) {
            return this.substringSearch(trimmed, limit);
        }

        const ranked =
            fuzzyTokens.length === 1
                ? (this.fuse.search(fuzzyTokens[0]) as CourseSearchResult<T>[])
                : this.coverageSearch(fuzzyTokens);

        // Fuse found nothing (rare typo against every field): still try substring
        // so a literal prefix of a title keeps working.
        if (ranked.length === 0) {
            return this.substringSearch(trimmed, limit);
        }

        return ranked.slice(0, limit);
    }

    /**
     * Rank by how many query tokens each record matches. Each token is searched
     * independently; a record's coverage is the number of tokens it matched and
     * its score is the average best Fuse score across those tokens (lower is
     * better).
     */
    private coverageSearch(tokens: string[]): CourseSearchResult<T>[] {
        const agg = new Map<number, { item: T; covered: number; scoreSum: number }>();

        for (const token of tokens) {
            // Best (lowest) score this token achieves against each record.
            const bestPerRecord = new Map<number, number>();
            for (const result of this.fuse.search(token)) {
                const score = result.score ?? 1;
                const prev = bestPerRecord.get(result.refIndex);
                if (prev === undefined || score < prev) {
                    bestPerRecord.set(result.refIndex, score);
                }
            }

            for (const [refIndex, score] of bestPerRecord) {
                const entry = agg.get(refIndex);
                if (entry) {
                    entry.covered += 1;
                    entry.scoreSum += score;
                } else {
                    agg.set(refIndex, {
                        item: this.records[refIndex],
                        covered: 1,
                        scoreSum: score,
                    });
                }
            }
        }

        return [...agg.entries()]
            .map(([refIndex, { item, covered, scoreSum }]) => ({
                item,
                refIndex,
                score: scoreSum / covered,
                covered,
            }))
            .sort((a, b) => b.covered - a.covered || a.score - b.score)
            .map(({ item, refIndex, score }) => ({ item, refIndex, score }));
    }

    /** Case-insensitive substring match, prefixes and title hits ranked first. */
    private substringSearch(query: string, limit: number): CourseSearchResult<T>[] {
        const needle = query.toLowerCase();
        const results: (CourseSearchResult<T> & { rank: number })[] = [];

        this.records.forEach((item, refIndex) => {
            const inTitle = item.title.toLowerCase().indexOf(needle);
            const inCode = item.code.toLowerCase().indexOf(needle);
            const inAlias = (item.aliases ?? []).some((alias) =>
                alias.toLowerCase().includes(needle),
            );
            if (inTitle === -1 && inCode === -1 && !inAlias) return;

            // Earlier match position wins; title beats code beats alias-only.
            const rank =
                inTitle !== -1
                    ? inTitle
                    : inCode !== -1
                      ? 1000 + inCode
                      : 2000;
            results.push({ item, refIndex, score: rank / 10000, rank });
        });

        return results
            .sort((a, b) => a.rank - b.rank)
            .slice(0, limit)
            .map(({ item, refIndex, score }) => ({ item, refIndex, score }));
    }
}

export type CourseFuse<T extends CourseFuseRecord> = CourseSearcher<T>;

export function createCourseFuse<T extends CourseFuseRecord>(records: T[]) {
    return new CourseSearcher(records);
}
