const { createScriptDb, queryRows } = require("./lib/db.ts");
const DRY_RUN = process.argv.includes("--dry-run");

const normalizeName = (name) => name.trim().replace(/\s+/g, " ");
const normalizeKey = (name) => normalizeName(name).toLowerCase();

const usageCount = (tag) =>
    (tag?.notes || 0) +
    (tag?.pastPapers || 0) +
    (tag?.forumPosts || 0);

function pickCanonical(group) {
    const sorted = [...group].sort((a, b) => {
        const usageDiff = usageCount(b) - usageCount(a);
        if (usageDiff !== 0) return usageDiff;
        const lengthDiff = normalizeName(a.name).length - normalizeName(b.name).length;
        if (lengthDiff !== 0) return lengthDiff;
        return a.name.localeCompare(b.name);
    });
    return sorted[0];
}

async function reassignJoinTable(client, { table, label }, duplicateId, canonicalId) {
    const [{ count: totalCount = 0 } = {}] = await queryRows(
        client,
        `SELECT COUNT(*)::INT AS count FROM "${table}" WHERE "B" = $1`,
        [duplicateId],
    );
    const [{ count: duplicateOverlap = 0 } = {}] = await queryRows(
        client,
        `
            SELECT COUNT(*)::INT AS count
            FROM "${table}" dup
            WHERE dup."B" = $2
              AND EXISTS (
                  SELECT 1
                  FROM "${table}" canon
                  WHERE canon."A" = dup."A"
                    AND canon."B" = $1
              )
        `,
        [canonicalId, duplicateId],
    );

    if (!DRY_RUN && Number(totalCount) > 0) {
        await client.query(
            `
                INSERT INTO "${table}" ("A", "B")
                SELECT rel."A", $1
                FROM "${table}" rel
                WHERE rel."B" = $2
                ON CONFLICT ("A", "B") DO NOTHING
            `,
            [canonicalId, duplicateId],
        );
        await client.query(`DELETE FROM "${table}" WHERE "B" = $1`, [duplicateId]);
    }

    return {
        connected: Number(totalCount) - Number(duplicateOverlap),
        disconnected: Number(duplicateOverlap),
        total: Number(totalCount),
        label,
    };
}

async function main() {
    const { pool, close } = createScriptDb();
    const client = await pool.connect();

    try {
        const tags = await queryRows(
            client,
            `
                SELECT
                    t.id,
                    t.name,
                    t.aliases,
                    COUNT(DISTINCT ntt."A")::INT AS notes,
                    COUNT(DISTINCT ppt."A")::INT AS "pastPapers",
                    COUNT(DISTINCT fpt."A")::INT AS "forumPosts"
                FROM "Tag" t
                LEFT JOIN "_NoteToTag" ntt ON ntt."B" = t.id
                LEFT JOIN "_PastPaperToTag" ppt ON ppt."B" = t.id
                LEFT JOIN "_ForumPostToTag" fpt ON fpt."B" = t.id
                GROUP BY t.id, t.name, t.aliases
                ORDER BY t.name ASC
            `,
        );

        const emptyTags = tags.filter((tag) => normalizeName(tag.name).length === 0);
        const nonEmptyTags = tags.filter((tag) => normalizeName(tag.name).length > 0);

        const groups = new Map();
        for (const tag of nonEmptyTags) {
            const key = normalizeKey(tag.name);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(tag);
        }

        const duplicateGroups = Array.from(groups.values()).filter(
            (group) => group.length > 1
        );

        console.log(
            JSON.stringify(
                {
                    dryRun: DRY_RUN,
                    totalTags: tags.length,
                    emptyTags: emptyTags.length,
                    duplicateGroups: duplicateGroups.length,
                },
                null,
                2
            )
        );

        if (!DRY_RUN) {
            await client.query("BEGIN");
        }

        for (const tag of emptyTags) {
            console.log(
                `[empty] ${tag.id} "${tag.name}" usage=${usageCount(tag)}`
            );
            if (!DRY_RUN) {
                await client.query(`DELETE FROM "Tag" WHERE id = $1`, [tag.id]);
            }
        }

        const modelList = [
            { table: "_NoteToTag", label: "notes" },
            { table: "_PastPaperToTag", label: "pastPapers" },
            { table: "_ForumPostToTag", label: "forumPosts" },
        ];

        for (const group of duplicateGroups) {
            const canonical = pickCanonical(group);
            const canonicalName = normalizeName(canonical.name);
            const canonicalId = canonical.id;
            const duplicates = group.filter((tag) => tag.id !== canonicalId);

            const aliasSet = new Map();
            for (const alias of canonical.aliases || []) {
                const cleaned = normalizeName(alias);
                if (cleaned) aliasSet.set(cleaned.toLowerCase(), cleaned);
            }

            for (const dup of duplicates) {
                const cleanedName = normalizeName(dup.name);
                if (cleanedName) {
                    aliasSet.set(cleanedName.toLowerCase(), cleanedName);
                }
                for (const alias of dup.aliases || []) {
                    const cleanedAlias = normalizeName(alias);
                    if (cleanedAlias) {
                        aliasSet.set(cleanedAlias.toLowerCase(), cleanedAlias);
                    }
                }
            }

            console.log(
                `[merge] canonical="${canonicalName}" (${canonicalId}) <- ${duplicates
                    .map((tag) => `${normalizeName(tag.name)} (${tag.id})`)
                    .join(", ")}`
            );

            if (!DRY_RUN) {
                const mergedAliases = Array.from(aliasSet.values()).filter(
                    (alias) => alias.toLowerCase() !== canonicalName.toLowerCase()
                );
                await client.query(
                    `
                        UPDATE "Tag"
                        SET name = $2,
                            aliases = $3,
                            "updatedAt" = NOW()
                        WHERE id = $1
                    `,
                    [canonicalId, canonicalName, mergedAliases],
                );
            }

            for (const dup of duplicates) {
                for (const model of modelList) {
                    const stats = await reassignJoinTable(
                        client,
                        model,
                        dup.id,
                        canonicalId
                    );
                    if (stats.total > 0) {
                        console.log(
                            `  ↳ ${stats.label}: connected ${stats.connected}, disconnected ${stats.disconnected}`
                        );
                    }
                }

                if (!DRY_RUN) {
                    await client.query(`DELETE FROM "Tag" WHERE id = $1`, [dup.id]);
                }
            }
        }

        if (!DRY_RUN) {
            await client.query("COMMIT");
        }
    } catch (error) {
        if (!DRY_RUN) {
            await client.query("ROLLBACK");
        }
        throw error;
    } finally {
        client.release();
        await close();
    }
}

main()
    .catch((error) => {
        console.error("Tag cleanup failed", error);
        process.exit(1);
    });
