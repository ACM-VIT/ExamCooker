const { PrismaClient } = require('./src/generated/prisma')
const fs = require('node:fs')
const path = require('node:path')

const prisma = new PrismaClient()
const OUTPUT_FILE = path.resolve(__dirname, 'current_tags.json')

async function main() {
  const tags = await prisma.tag.findMany({
    orderBy: {
      name: 'asc',
    },
  })

  if (!tags.length) {
    console.log('No tags found in the database.')
    return
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tags, null, 2))
  console.log(`Saved ${tags.length} tags to ${OUTPUT_FILE}`)
}

main()
  .catch(error => {
    console.error('Error reading tags:', error)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
