const { PrismaClient } = require("../src/generated/prisma");
const { EXAM_TAGS, mergeAliases } = require("./lib/past-paper-exam-tags");

const prisma = new PrismaClient();

async function main() {
  for (const { label: name, aliases } of EXAM_TAGS) {
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
