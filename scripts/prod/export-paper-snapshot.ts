import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { createScriptDb, queryRows } from "../lib/db";
import { loadScriptEnv } from "../lib/env";

loadScriptEnv();

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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(REPORT_DIR, { recursive: true });
  const outputFile =
    options.outputFile ?? path.join(REPORT_DIR, `prod-paper-snapshot-${timestamp()}.json`);

  const { pool, close } = createScriptDb(options.databaseUrl);

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
      queryRows(
        pool,
        'SELECT migration_name, started_at, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY finished_at NULLS LAST, migration_name',
      ),
      queryRows(pool, 'SELECT * FROM "Tag" ORDER BY id'),
      queryRows(pool, 'SELECT * FROM "PastPaper" ORDER BY id'),
      queryRows(pool, 'SELECT * FROM "_PastPaperToTag" ORDER BY "A", "B"'),
      queryRows<{ count: number }>(pool, 'SELECT COUNT(*)::INT AS count FROM "Note"'),
      queryRows<{ count: number }>(pool, 'SELECT COUNT(*)::INT AS count FROM "ForumPost"'),
      queryRows<{ count: number }>(pool, 'SELECT COUNT(*)::INT AS count FROM "User"'),
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
    await close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
