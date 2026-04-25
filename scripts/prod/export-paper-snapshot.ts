import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true, quiet: true });

type Options = {
  databaseUrl: string;
  outputFile: string | null;
};

const REPORT_DIR = path.resolve(process.cwd(), "scripts/reports");

function usage() {
  console.log(
    [
      "Usage:",
      "  pnpm prod:export_paper_snapshot [options]",
      "",
      "Environment:",
      "  TARGET_DATABASE_URL or PROD_DATABASE_URL or PROD_DB",
      "",
      "Options:",
      "  --db=<url>",
      "  --output=<path>",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    databaseUrl:
      process.env.TARGET_DATABASE_URL?.trim() ||
      process.env.PROD_DATABASE_URL?.trim() ||
      process.env.PROD_DB?.trim() ||
      "",
    outputFile: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    let flag = arg;
    let value: string | undefined;
    if (arg.includes("=")) {
      const [parsedFlag, parsedValue] = arg.split("=", 2);
      flag = parsedFlag;
      value = parsedValue?.trim();
    } else {
      const nextArg = argv[index + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        value = nextArg.trim();
        index += 1;
      }
    }

    if (!value) continue;

    switch (flag) {
      case "--db":
        options.databaseUrl = value;
        break;
      case "--output":
        options.outputFile = path.resolve(process.cwd(), value);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.databaseUrl) {
    throw new Error("Missing target database URL. Set PROD_DB or pass --db.");
  }

  return options;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function rowsToObjects(columnNames: string[], rows: unknown[][]) {
  return rows.map((row) =>
    Object.fromEntries(columnNames.map((columnName, index) => [columnName, row[index] ?? null])),
  );
}

async function queryObjects(
  connection: Awaited<ReturnType<PrismaPg["connect"]>>,
  sql: string,
) {
  const result = await connection.queryRaw({ sql, args: [], argTypes: [] });
  return rowsToObjects(result.columnNames, result.rows);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(REPORT_DIR, { recursive: true });
  const outputFile =
    options.outputFile ?? path.join(REPORT_DIR, `prod-paper-snapshot-${timestamp()}.json`);

  const adapter = new PrismaPg(options.databaseUrl);
  const connection = await adapter.connect();

  try {
    const [
      migrations,
      tags,
      pastPapers,
      paperTags,
      noteCount,
      forumCount,
      userCount,
    ] = await Promise.all([
      queryObjects(
        connection,
        'SELECT migration_name, started_at, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY finished_at NULLS LAST, migration_name',
      ),
      queryObjects(connection, 'SELECT * FROM "Tag" ORDER BY id'),
      queryObjects(connection, 'SELECT * FROM "PastPaper" ORDER BY id'),
      queryObjects(connection, 'SELECT * FROM "_PastPaperToTag" ORDER BY "A", "B"'),
      queryObjects(connection, 'SELECT COUNT(*)::INT AS count FROM "Note"'),
      queryObjects(connection, 'SELECT COUNT(*)::INT AS count FROM "ForumPost"'),
      queryObjects(connection, 'SELECT COUNT(*)::INT AS count FROM "User"'),
    ]);

    const snapshot = {
      generatedAt: new Date().toISOString(),
      databaseHost: new URL(options.databaseUrl).host,
      counts: {
        pastPapers: pastPapers.length,
        tags: tags.length,
        paperTagLinks: paperTags.length,
        notes: Number(noteCount[0]?.count ?? 0),
        forumPosts: Number(forumCount[0]?.count ?? 0),
        users: Number(userCount[0]?.count ?? 0),
      },
      migrations,
      tags,
      pastPapers,
      paperTags,
    };

    await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    console.log(
      JSON.stringify(
        {
          outputFile,
          counts: snapshot.counts,
        },
        null,
        2,
      ),
    );
  } finally {
    await connection.dispose();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
