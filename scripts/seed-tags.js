const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { createScriptDb } = require("./lib/db.ts");
const { tag } = require("../src/db/schema.ts");

async function main(filepath) {
    const { db, close } = createScriptDb();
    const resolvedPath = filepath
        ? path.resolve(process.cwd(), filepath)
        : path.resolve(__dirname, 'tags.txt');

    try {
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Tag seed file not found: ${resolvedPath}`);
        }

        const fileStream = fs.createReadStream(resolvedPath);

        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });

        for await (const rawLine of rl) {
            const line = rawLine.trim();
            if (!line) {
                continue;
            }

            try {
                const [savedTag] = await db
                    .insert(tag)
                    .values({
                        name: line,
                        aliases: [],
                    })
                    .onConflictDoUpdate({
                        target: tag.name,
                        set: {
                            aliases: [],
                        },
                    })
                    .returning({
                        id: tag.id,
                        name: tag.name,
                    });
                console.log(`Created tag ${savedTag.name} with id: ${savedTag.id}`);
            } catch (error) {
                console.error(`Error creating tag ${line}: ${error}`);
            }
        }
    } finally {
        await close();
    }
}

main(process.argv[2]).then(() => {
    console.log('Seed complete')
}).catch((error) => {
    console.error(`Error seeding tags: ${error}`)
})
