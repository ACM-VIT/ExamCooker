const { PrismaClient } = require('../src/generated/prisma')
const fs = require('node:fs')
const path = require('node:path')

const prisma = new PrismaClient()

const COURSE_LIST_PATH = path.resolve(__dirname, 'course_list.json')
const CURRENT_TAGS_PATH = path.resolve(__dirname, 'current_tags.json')
const BATCH_SIZE = 25
const IS_DRY_RUN = process.argv.includes('--dry-run')

function loadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error.message}`)
  }
}

function normalizeName(value) {
  if (!value) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

async function main() {
  const courseList = loadJson(COURSE_LIST_PATH)
  const currentTags = loadJson(CURRENT_TAGS_PATH)

  const existingNames = new Set()
  currentTags.forEach(tag => {
    const normalized = normalizeName(tag?.name ?? tag)
    if (normalized) existingNames.add(normalized)
  })

  const missingNames = []
  courseList.forEach(course => {
    const normalized = normalizeName(course?.name)
    if (!normalized || existingNames.has(normalized)) return
    existingNames.add(normalized)
    missingNames.push(normalized)
  })

  if (!missingNames.length) {
    console.log('All course entries already exist as tags.')
    return
  }

  if (IS_DRY_RUN) {
    console.log(`Dry run: ${missingNames.length} tags would be added:`)
    missingNames.forEach(name => console.log(`- ${name}`))
    return
  }

  console.log(`Adding ${missingNames.length} missing tags...`)
  let created = 0

  for (let i = 0; i < missingNames.length; i += BATCH_SIZE) {
    const batch = missingNames.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(name =>
        prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name, aliases: [] },
        })
      )
    )

    results.forEach((result, idx) => {
      const tagName = batch[idx]
      if (result.status === 'fulfilled') {
        created += 1
        console.log(`✔ Added tag: ${tagName}`)
      } else {
        console.error(`✖ Failed to add "${tagName}":`, result.reason?.message ?? result.reason)
      }
    })
  }

  console.log(`Done. Successfully added ${created}/${missingNames.length} tags.`)
}

main()
  .catch(error => {
    console.error('Error syncing tags:', error)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
