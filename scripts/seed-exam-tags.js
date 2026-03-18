const { PrismaClient } = require("../src/generated/prisma");

const prisma = new PrismaClient();

const EXAM_TAGS = ["CAT-1", "CAT-2", "FAT"];

async function main() {
  for (const name of EXAM_TAGS) {
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, aliases: [] },
    });
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
