const { PrismaClient } = require("../src/generated/prisma");

const prisma = new PrismaClient();

const EXAM_TAGS = {
  "CAT-1": ["cat1", "cat 1", "cat-1"],
  "CAT-2": ["cat2", "cat 2", "cat-2"],
  FAT: ["fat"],
};

function mergeAliases(existingAliases, canonicalAliases) {
  const seen = new Set();
  const merged = [];

  for (const alias of [...(existingAliases || []), ...(canonicalAliases || [])]) {
    const value = String(alias || "").trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    merged.push(value);
  }

  return merged;
}

async function main() {
  for (const [name, aliases] of Object.entries(EXAM_TAGS)) {
    const existing = await prisma.tag.findUnique({
      where: { name },
      select: { id: true, aliases: true },
    });

    if (existing) {
      await prisma.tag.update({
        where: { id: existing.id },
        data: { aliases: mergeAliases(existing.aliases, aliases) },
      });
    } else {
      await prisma.tag.create({
        data: { name, aliases },
      });
    }

    console.log(`Ensured exam tag: ${name}`);
  }
}

main()
  .catch((error) => {
    console.error("Failed to seed exam tags:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
