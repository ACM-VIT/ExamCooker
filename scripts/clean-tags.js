const dotenv = require("dotenv");
const { PrismaClient } = require("../src/generated/prisma");

dotenv.config();

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const normalizeName = (name) => name.trim().replace(/\s+/g, " ");
const normalizeKey = (name) => normalizeName(name).toLowerCase();

const usageCount = (tag) =>
    (tag?._count?.notes || 0) +
    (tag?._count?.pastPapers || 0) +
    (tag?._count?.forumPosts || 0);

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

async function reassignModel({ model, label }, duplicateId, canonicalId) {
    const toConnect = await prisma[model].findMany({
        where: {
            AND: [
                { tags: { some: { id: duplicateId } } },
                { NOT: { tags: { some: { id: canonicalId } } } },
            ],
        },
        select: { id: true },
    });

    const toDisconnectOnly = await prisma[model].findMany({
        where: {
            AND: [
                { tags: { some: { id: duplicateId } } },
                { tags: { some: { id: canonicalId } } },
            ],
        },
        select: { id: true },
    });

    if (!DRY_RUN) {
        for (const record of toConnect) {
            await prisma[model].update({
                where: { id: record.id },
                data: {
                    tags: {
                        connect: { id: canonicalId },
                        disconnect: { id: duplicateId },
                    },
                },
            });
        }

        for (const record of toDisconnectOnly) {
            await prisma[model].update({
                where: { id: record.id },
                data: {
                    tags: {
                        disconnect: { id: duplicateId },
                    },
                },
            });
        }
    }

    return {
        connected: toConnect.length,
        disconnected: toDisconnectOnly.length,
        total: toConnect.length + toDisconnectOnly.length,
        label,
    };
}

async function main() {
    const tags = await prisma.tag.findMany({
        include: {
            _count: { select: { notes: true, pastPapers: true, forumPosts: true } },
        },
    });

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

    for (const tag of emptyTags) {
        console.log(
            `[empty] ${tag.id} "${tag.name}" usage=${usageCount(tag)}`
        );
        if (!DRY_RUN) {
            await prisma.tag.delete({ where: { id: tag.id } });
        }
    }

    const modelList = [
        { model: "note", label: "notes" },
        { model: "pastPaper", label: "pastPapers" },
        { model: "forumPost", label: "forumPosts" },
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
            if (canonical.name !== canonicalName) {
                await prisma.tag.update({
                    where: { id: canonicalId },
                    data: { name: canonicalName },
                });
            }

            const mergedAliases = Array.from(aliasSet.values()).filter(
                (alias) => alias.toLowerCase() !== canonicalName.toLowerCase()
            );
            await prisma.tag.update({
                where: { id: canonicalId },
                data: { aliases: mergedAliases },
            });
        }

        for (const dup of duplicates) {
            for (const model of modelList) {
                const stats = await reassignModel(
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
                await prisma.tag.delete({ where: { id: dup.id } });
            }
        }
    }
}

main()
    .catch((error) => {
        console.error("Tag cleanup failed", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
