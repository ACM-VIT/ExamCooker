import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true, quiet: true });

type StepStatus = "pending" | "completed" | "skipped" | "failed";

type StepRecord = {
  name: string;
  status: StepStatus;
  command: string[];
  logFile: string;
  startedAt: string;
  completedAt: string | null;
};

type Options = {
  sourceDatabaseUrl: string;
  targetDatabaseUrl: string;
  verifiedLedgerFile: string;
  assetConnectionString: string;
  assetContainerName: string;
  assetPublicBaseUrl: string;
  importUserEmail: string;
  importUserName: string;
  createdAfter: string | null;
  courseCodes: string[];
  limit: number | null;
  dryRun: boolean;
  paperScopedOnly: boolean;
  createOnly: boolean;
  skipSchema: boolean;
  skipSeedCourses: boolean;
  skipMetadataBackfill: boolean;
  skipAnswerKeyLinkBackfill: boolean;
  skipPromotion: boolean;
  skipAssetMigration: boolean;
};

type RunSummary = {
  generatedAt: string;
  runDirectory: string;
  dryRun: boolean;
  sourceDatabaseHost: string;
  targetDatabaseHost: string;
  verifiedLedgerFile: string;
  steps: StepRecord[];
};

const REPORT_ROOT = path.resolve(process.cwd(), "scripts/reports");

function usage() {
  console.log(
    [
      "Usage:",
      "  pnpm prod:paper_cutover [options]",
      "",
      "Required environment:",
      "  TARGET_DATABASE_URL or PROD_DATABASE_URL or PROD_DB",
      "  SOURCE_DATABASE_URL or DEV_DATABASE",
      "  AZURE_STORAGE_CONNECTION_STRING",
      "  AZURE_STORAGE_CONTAINER",
      "  AZURE_BLOB_PUBLIC_BASE_URL",
      "",
      "Options:",
      "  --dry-run",
      "  --allow-global-backfill",
      "  --allow-updates",
      "  --created-after=2026-04-20T00:00:00.000Z",
      "  --course-codes=BCSE202L,BMAT101L",
      "  --limit=50",
      "  --source-db=<url>",
      "  --target-db=<url>",
      "  --ledger=<path>",
      "  --import-user-email=<email>",
      "  --import-user-name=<name>",
      "  --skip-schema",
      "  --skip-seed-courses",
      "  --skip-metadata-backfill",
      "  --skip-answer-key-link-backfill",
      "  --skip-promotion",
      "  --skip-asset-migration",
    ].join("\n"),
  );
}

function parsePositiveInt(flag: string, value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer. Received: ${value}`);
  }
  return parsed;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    sourceDatabaseUrl:
      process.env.SOURCE_DATABASE_URL?.trim() ||
      process.env.DEV_DATABASE?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      "",
    targetDatabaseUrl:
      process.env.TARGET_DATABASE_URL?.trim() ||
      process.env.PROD_DATABASE_URL?.trim() ||
      process.env.PROD_DB?.trim() ||
      "",
    verifiedLedgerFile: path.resolve(
      process.cwd(),
      "../examcooker-ingest/state/verification/ledger.json",
    ),
    assetConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING?.trim() || "",
    assetContainerName: process.env.AZURE_STORAGE_CONTAINER?.trim() || "",
    assetPublicBaseUrl: process.env.AZURE_BLOB_PUBLIC_BASE_URL?.trim() || "",
    importUserEmail: process.env.PROD_IMPORT_USER_EMAIL?.trim() || "prod-import@examcooker.local",
    importUserName: process.env.PROD_IMPORT_USER_NAME?.trim() || "ExamCooker Production Import",
    createdAfter: null,
    courseCodes: [],
    limit: null,
    dryRun: false,
    paperScopedOnly: true,
    createOnly: true,
    skipSchema: false,
    skipSeedCourses: false,
    skipMetadataBackfill: false,
    skipAnswerKeyLinkBackfill: false,
    skipPromotion: false,
    skipAssetMigration: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--allow-global-backfill") {
      options.paperScopedOnly = false;
      continue;
    }

    if (arg === "--allow-updates") {
      options.createOnly = false;
      continue;
    }

    if (arg === "--skip-schema") {
      options.skipSchema = true;
      continue;
    }

    if (arg === "--skip-seed-courses") {
      options.skipSeedCourses = true;
      continue;
    }

    if (arg === "--skip-metadata-backfill") {
      options.skipMetadataBackfill = true;
      continue;
    }

    if (arg === "--skip-answer-key-link-backfill") {
      options.skipAnswerKeyLinkBackfill = true;
      continue;
    }

    if (arg === "--skip-promotion") {
      options.skipPromotion = true;
      continue;
    }

    if (arg === "--skip-asset-migration") {
      options.skipAssetMigration = true;
      continue;
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

    if (!value) {
      throw new Error(`Expected a value for ${flag}`);
    }

    switch (flag) {
      case "--source-db":
        options.sourceDatabaseUrl = value;
        break;
      case "--target-db":
        options.targetDatabaseUrl = value;
        break;
      case "--ledger":
        options.verifiedLedgerFile = path.resolve(process.cwd(), value);
        break;
      case "--import-user-email":
        options.importUserEmail = value;
        break;
      case "--import-user-name":
        options.importUserName = value;
        break;
      case "--course-codes":
        options.courseCodes = value
          .split(",")
          .map((entry) => entry.trim().toUpperCase())
          .filter(Boolean);
        break;
      case "--created-after":
        options.createdAfter = value;
        break;
      case "--limit":
        options.limit = parsePositiveInt(flag, value);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.sourceDatabaseUrl) throw new Error("Missing source database URL.");
  if (!options.targetDatabaseUrl) throw new Error("Missing target database URL.");
  if (options.sourceDatabaseUrl === options.targetDatabaseUrl) {
    throw new Error("Source and target database URLs are identical. Refusing to run.");
  }

  if (!options.skipAssetMigration) {
    if (!options.assetConnectionString) throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING.");
    if (!options.assetContainerName) throw new Error("Missing AZURE_STORAGE_CONTAINER.");
    if (!options.assetPublicBaseUrl) throw new Error("Missing AZURE_BLOB_PUBLIC_BASE_URL.");
  }

  return options;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function runCommand(params: {
  command: string[];
  env: NodeJS.ProcessEnv;
  logFile: string;
}) {
  const [bin, ...args] = params.command;
  if (!bin) throw new Error("Missing command binary.");

  return new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: process.cwd(),
      env: params.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let combined = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      combined += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      combined += text;
      process.stderr.write(text);
    });

    child.on("close", async (code) => {
      await writeFile(params.logFile, combined, "utf8");
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed (${code}): ${params.command.join(" ")}`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runDirectory = path.join(REPORT_ROOT, `prod-cutover-${timestamp()}`);
  await mkdir(runDirectory, { recursive: true });

  const summary: RunSummary = {
    generatedAt: new Date().toISOString(),
    runDirectory,
    dryRun: options.dryRun,
    sourceDatabaseHost: new URL(options.sourceDatabaseUrl).host,
    targetDatabaseHost: new URL(options.targetDatabaseUrl).host,
    verifiedLedgerFile: options.verifiedLedgerFile,
    steps: [],
  };

  const commonTargetEnv = {
    ...process.env,
    DATABASE_URL: options.targetDatabaseUrl,
  };

  const promotionManifestPath = path.join(runDirectory, "promotion-manifest.json");
  const promotionMarkdownPath = path.join(runDirectory, "promotion-report.md");

  const stepDefinitions: Array<{
    name: string;
    skip: boolean;
    command: string[];
    env: NodeJS.ProcessEnv;
  }> = [
    {
      name: options.dryRun ? "schema-validate" : "schema-migrate",
      skip: options.skipSchema,
      command: options.dryRun
        ? ["pnpm", "exec", "drizzle-kit", "introspect", "--config", "drizzle.config.ts"]
        : ["pnpm", "exec", "drizzle-kit", "push", "--config", "drizzle.config.ts"],
      env: commonTargetEnv,
    },
    {
      name: "seed-courses",
      skip: options.skipSeedCourses,
      command: ["pnpm", "exec", "tsx", "scripts/seed-courses.js", ...(options.dryRun ? ["--dry-run"] : [])],
      env: commonTargetEnv,
    },
    {
      name: "backfill-metadata",
      skip: options.skipMetadataBackfill,
      command: [
        "pnpm",
        "exec",
        "tsx",
        "scripts/backfill-paper-metadata.js",
        ...(options.dryRun ? ["--dry-run"] : []),
        ...(options.paperScopedOnly ? ["--papers-only"] : []),
      ],
      env: commonTargetEnv,
    },
    {
      name: "backfill-answer-key-links",
      skip: options.skipAnswerKeyLinkBackfill,
      command: [
        "pnpm",
        "exec",
        "tsx",
        "scripts/backfill-answer-key-links.ts",
        ...(options.dryRun ? ["--dry-run"] : []),
      ],
      env: commonTargetEnv,
    },
    {
      name: "promote-dev-papers",
      skip: options.skipPromotion,
      command: [
        "pnpm",
        "exec",
        "tsx",
        "scripts/prod/promote-dev-papers.ts",
        ...(options.dryRun ? ["--dry-run"] : []),
        "--source-db",
        options.sourceDatabaseUrl,
        "--target-db",
        options.targetDatabaseUrl,
        "--ledger",
        options.verifiedLedgerFile,
        "--import-user-email",
        options.importUserEmail,
        "--import-user-name",
        options.importUserName,
        ...(options.createdAfter ? ["--created-after", options.createdAfter] : []),
        ...(options.createOnly ? [] : ["--allow-updates"]),
        "--output-manifest",
        promotionManifestPath,
        "--output-markdown",
        promotionMarkdownPath,
        ...(options.courseCodes.length > 0 ? ["--course-codes", options.courseCodes.join(",")] : []),
        ...(options.limit ? ["--limit", String(options.limit)] : []),
      ],
      env: process.env,
    },
    {
      name: "migrate-paper-assets",
      skip: options.skipAssetMigration,
      command: [
        "pnpm",
        "exec",
        "tsx",
        "scripts/prod/migrate-azure-past-papers.ts",
        ...(options.dryRun ? ["--dry-run"] : []),
        "--manifest",
        promotionManifestPath,
      ],
      env: {
        ...process.env,
        TARGET_DATABASE_URL: options.targetDatabaseUrl,
        AZURE_STORAGE_CONNECTION_STRING: options.assetConnectionString,
        AZURE_STORAGE_CONTAINER: options.assetContainerName,
        AZURE_BLOB_PUBLIC_BASE_URL: options.assetPublicBaseUrl,
      },
    },
  ];

  for (const stepDefinition of stepDefinitions) {
    const logFile = path.join(runDirectory, `${stepDefinition.name}.log`);
    const record: StepRecord = {
      name: stepDefinition.name,
      status: stepDefinition.skip ? "skipped" : "pending",
      command: stepDefinition.command,
      logFile,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
    summary.steps.push(record);

    if (stepDefinition.skip) {
      record.completedAt = new Date().toISOString();
      continue;
    }

    try {
      await runCommand({
        command: stepDefinition.command,
        env: stepDefinition.env,
        logFile,
      });
      record.status = "completed";
      record.completedAt = new Date().toISOString();
    } catch (error) {
      record.status = "failed";
      record.completedAt = new Date().toISOString();
      await writeFile(
        path.join(runDirectory, "summary.json"),
        `${JSON.stringify(summary, null, 2)}\n`,
        "utf8",
      );
      throw error;
    }
  }

  const summaryPath = path.join(runDirectory, "summary.json");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        runDirectory,
        summaryPath,
        promotionManifestPath,
        promotionMarkdownPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
