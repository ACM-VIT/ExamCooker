const fs = require("fs");
const path = require("path");
const { createScriptDb, queryRows } = require("./lib/db.ts");

const YEAR_REGEX = /^(19|20)\d{2}$/;
const SLOT_REGEX = /^[A-G][1-2]$/i;
const COURSE_CODE_REGEX = /^[A-Z]{2,7}\s?\d{2,5}[A-Z]{0,3}$/;
const COURSE_CODE_IN_BRACKETS_REGEX = /\[(?<code>[A-Z]{2,7}\s?\d{2,5}[A-Z]{0,3})\]/;
const EXAM_TYPE_REGEX = /^(cat-?1|cat-?2|fat|mid|midterm|quiz|cia)$/i;
const WORDY_REGEX = /[a-zA-Z]{3,}/;
const ONLY_ALNUM_REGEX = /^[a-zA-Z0-9]+$/;
const SPACES_REGEX = /\s{2,}/;
const MULTIWORD_REGEX = /[a-zA-Z]{3,}.*\s+.*[a-zA-Z]{3,}/;

function classifyTag(name) {
    const trimmed = name.trim();
    if (!trimmed) return "empty";
    if (YEAR_REGEX.test(trimmed)) return "year";
    if (SLOT_REGEX.test(trimmed)) return "slot";
    if (COURSE_CODE_REGEX.test(trimmed)) return "course_code";
    if (COURSE_CODE_IN_BRACKETS_REGEX.test(trimmed)) return "course_title";
    if (EXAM_TYPE_REGEX.test(trimmed)) return "exam_type";
    if (trimmed.length <= 2) return "too_short";
    if (!WORDY_REGEX.test(trimmed) && ONLY_ALNUM_REGEX.test(trimmed)) return "numeric_or_code";
    if (SPACES_REGEX.test(trimmed)) return "spacing";
    if (MULTIWORD_REGEX.test(trimmed)) return "topic";
    if (/[`~!@#$%^&*()=+{}|;:'",<>?/\\]/.test(trimmed)) return "has_symbols";
    return "other";
}

function totalUsage(count) {
    return count.notes + count.pastPapers + count.forumPosts;
}

async function main() {
    const { pool, close } = createScriptDb();
    try {
        const tags = await queryRows(
            pool,
            `
                SELECT
                    t.name,
                    t.aliases,
                    t."updatedAt",
                    COUNT(DISTINCT ntt."A")::INT AS notes,
                    COUNT(DISTINCT ppt."A")::INT AS "pastPapers",
                    COUNT(DISTINCT fpt."A")::INT AS "forumPosts"
                FROM "Tag" t
                LEFT JOIN "_NoteToTag" ntt ON ntt."B" = t.id
                LEFT JOIN "_PastPaperToTag" ppt ON ppt."B" = t.id
                LEFT JOIN "_ForumPostToTag" fpt ON fpt."B" = t.id
                GROUP BY t.id, t.name, t.aliases, t."updatedAt"
                ORDER BY t.name ASC
            `,
        );

        const normalized = tags.map((tag) => {
            const counts = {
                notes: Number(tag.notes || 0),
                pastPapers: Number(tag.pastPapers || 0),
                forumPosts: Number(tag.forumPosts || 0),
            };
            const usage = totalUsage(counts);
            return {
                name: tag.name,
                nameLower: tag.name.toLowerCase(),
                category: classifyTag(tag.name),
                usage,
                notes: counts.notes,
                pastPapers: counts.pastPapers,
                forumPosts: counts.forumPosts,
                aliases: tag.aliases || [],
                updatedAt: tag.updatedAt ? new Date(tag.updatedAt).toISOString() : null,
            };
        });

    const totals = normalized.reduce(
        (acc, tag) => {
            acc.total += 1;
            acc.withUsage += tag.usage > 0 ? 1 : 0;
            acc.zeroUsage += tag.usage === 0 ? 1 : 0;
            acc.byCategory[tag.category] = (acc.byCategory[tag.category] || 0) + 1;
            acc.usageByCategory[tag.category] =
                (acc.usageByCategory[tag.category] || 0) + tag.usage;
            return acc;
        },
        { total: 0, withUsage: 0, zeroUsage: 0, byCategory: {}, usageByCategory: {} }
    );

    const topByCategory = normalized.reduce((acc, tag) => {
        if (!acc[tag.category]) acc[tag.category] = [];
        acc[tag.category].push(tag);
        return acc;
    }, {});

    Object.keys(topByCategory).forEach((category) => {
        topByCategory[category] = topByCategory[category]
            .sort((a, b) => b.usage - a.usage)
            .slice(0, 50);
    });

    const topTags = [...normalized]
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 50);

    const noisyCandidates = normalized
        .filter((tag) =>
            ["empty", "too_short", "numeric_or_code", "has_symbols", "spacing"].includes(tag.category)
        )
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 200);

    const duplicateLowercase = {};
    normalized.forEach((tag) => {
        if (!duplicateLowercase[tag.nameLower]) {
            duplicateLowercase[tag.nameLower] = [];
        }
        duplicateLowercase[tag.nameLower].push(tag.name);
    });
    const duplicates = Object.entries(duplicateLowercase)
        .filter(([, list]) => list.length > 1)
        .map(([key, list]) => ({ key, variants: list }));

        const report = {
            totals,
            topTags,
            topByCategory,
            noisyCandidates,
            duplicates,
        };

        const outDir = path.join(process.cwd(), "tmp");
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
        const outPath = path.join(outDir, "tag-audit.json");
        fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

        console.log("Tag audit summary");
        console.log(JSON.stringify({
            totals,
            topTagSample: topTags.slice(0, 10).map((t) => ({ name: t.name, usage: t.usage })),
            topCourseTitleSample: (topByCategory.course_title || [])
                .slice(0, 10)
                .map((t) => ({ name: t.name, usage: t.usage })),
            topTopicSample: (topByCategory.topic || [])
                .slice(0, 10)
                .map((t) => ({ name: t.name, usage: t.usage })),
            duplicateCount: duplicates.length,
            output: outPath,
        }, null, 2));
    } finally {
        await close();
    }
}

main()
    .catch((error) => {
        console.error("Tag audit failed", error);
        process.exit(1);
    });
