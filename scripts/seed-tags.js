const {PrismaClient} = require('../src/generated/prisma')
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const prisma = new PrismaClient()

async function main(filepath) {
    const resolvedPath = filepath
        ? path.resolve(process.cwd(), filepath)
        : path.resolve(__dirname, 'tags.txt');

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Tag seed file not found: ${resolvedPath}`);
    }

    const fileStream = fs.createReadStream(resolvedPath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });
    // Note: we use the crlfDelay option to recognize all instances of CR LF
    // ('\r\n') in input.txt as a single line break.

    for await (const line of rl) {
        // Each line in input.txt will be successively available here as `line`.
        prisma.tag.upsert({
            where: {
                name: line
            },
            update: {
                name: line,
                aliases: []
            },
            create: {
                name: line,
                aliases: []
            }
        }).then((tag) => {
            console.log(`Created tag ${tag.name} with id: ${tag.id}`)
        }).catch((error) => {
            console.error(`Error creating tag ${line}: ${error}`)
        })
    }
}

main(process.argv[2]).then(() => {
    console.log('Seed complete')
}).catch((error) => {
    console.error(`Error seeding tags: ${error}`)
}).finally(async () => {
    await prisma.$disconnect()
})
