const fs = require('node:fs')
const path = require('node:path')
const { asc } = require("drizzle-orm");
const { tag } = require("../db/schema.ts");
const { createScriptDb } = require("./lib/db.ts");
const OUTPUT_FILE = path.resolve(__dirname, 'current_tags.json')

async function main() {
  const { db, close } = createScriptDb()
  try {
    const tags = await db
      .select()
      .from(tag)
      .orderBy(asc(tag.name))

    if (!tags.length) {
      console.log('No tags found in the database.')
      return
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tags, null, 2))
    console.log(`Saved ${tags.length} tags to ${OUTPUT_FILE}`)
  } finally {
    await close()
  }
}

main()
  .catch(error => {
    console.error('Error reading tags:', error)
  })
