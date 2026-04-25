import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import dotenv from "dotenv";
import { BlobServiceClient } from "@azure/storage-blob";
import { PrismaPg } from "@prisma/adapter-pg";

import * as prismaClient from "../../prisma/generated/client";

const { PrismaClient } = prismaClient;

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true, quiet: true });

type PromotionManifest = {
  touchedPapers: Array<{
    sourcePaperId: string;
    targetPaperId: string;
    action: "create" | "update";
    courseCode: string | null;
    title: string;
    fileUrl: string;
    thumbNailUrl: string | null;
  }>;
};

type StateRecord = {
  sourceUrl: string;
  destinationUrl: string;
  contentType: string | null;
  bytes: number;
  updatedAt: string;
};

type StateFile = {
  version: 1;
  updatedAt: string | null;
  records: Record<string, StateRecord>;
};

type Options = {
  databaseUrl: string;
  manifestFile: string;
  connectionString: string;
  containerName: string;
  publicBaseUrl: string;
  stateFile: string;
  dryRun: boolean;
  copyConcurrency: number;
  skipContainerCreate: boolean;
};

const REPORT_DIR = path.resolve(process.cwd(), "scripts/reports");

function usage() {
  console.log(
    [
      "Usage:",
      "  pnpm prod:migrate_paper_assets --manifest=/abs/path/to/prod-paper-promotion.json [options]",
      "",
      "Environment:",
      "  TARGET_DATABASE_URL or PROD_DATABASE_URL or PROD_DB",
      "  AZURE_STORAGE_CONNECTION_STRING",
      "  AZURE_STORAGE_CONTAINER",
      "  AZURE_BLOB_PUBLIC_BASE_URL",
      "",
      "Options:",
      "  --dry-run",
      "  --manifest=<path>",
      "  --database-url=<url>",
      "  --connection-string=<value>",
      "  --container=<name>",
      "  --public-base-url=<url>",
      "  --state-file=<path>",
      "  --copy-concurrency=<n>",
      "  --skip-container-create",
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
    databaseUrl:
      process.env.TARGET_DATABASE_URL?.trim() ||
      process.env.PROD_DATABASE_URL?.trim() ||
      process.env.PROD_DB?.trim() ||
      "",
    manifestFile: "",
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING?.trim() || "",
    containerName: process.env.AZURE_STORAGE_CONTAINER?.trim() || "",
    publicBaseUrl: process.env.AZURE_BLOB_PUBLIC_BASE_URL?.trim() || "",
    stateFile: path.resolve(process.cwd(), "scripts/reports/prod-paper-asset-migration.state.json"),
    dryRun: false,
    copyConcurrency: 4,
    skipContainerCreate: false,
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

    if (arg === "--skip-container-create") {
      options.skipContainerCreate = true;
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
      case "--manifest":
        options.manifestFile = path.resolve(process.cwd(), value);
        break;
      case "--database-url":
        options.databaseUrl = value;
        break;
      case "--connection-string":
        options.connectionString = value;
        break;
      case "--container":
        options.containerName = value;
        break;
      case "--public-base-url":
        options.publicBaseUrl = value.replace(/\/+$/, "");
        break;
      case "--state-file":
        options.stateFile = path.resolve(process.cwd(), value);
        break;
      case "--copy-concurrency":
        options.copyConcurrency = parsePositiveInt(flag, value);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.databaseUrl) throw new Error("Missing target database URL.");
  if (!options.manifestFile) throw new Error("Missing --manifest file.");
  if (!options.connectionString) throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING.");
  if (!options.containerName) throw new Error("Missing AZURE_STORAGE_CONTAINER.");
  if (!options.publicBaseUrl) throw new Error("Missing AZURE_BLOB_PUBLIC_BASE_URL.");
  return options;
}

function createClient(connectionString: string) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

async function readJsonFile<T>(pathname: string, fallback: T) {
  try {
    const raw = await readFile(pathname, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function fileExtension(sourceUrl: string, contentType: string | null, fallback: string) {
  const pathname = new URL(sourceUrl).pathname;
  const ext = path.posix.extname(pathname);
  if (ext) return ext;
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("jpeg")) return ".jpg";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("pdf")) return ".pdf";
  return fallback;
}

async function mapLimit<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      await worker(next);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(REPORT_DIR, { recursive: true });

  const manifest = await readJsonFile<PromotionManifest>(options.manifestFile, { touchedPapers: [] });
  const target = createClient(options.databaseUrl);
  const state = await readJsonFile<StateFile>(options.stateFile, {
    version: 1,
    updatedAt: null,
    records: {},
  });

  try {
    const targetPaperIds = manifest.touchedPapers.map((paper) => paper.targetPaperId);
    if (targetPaperIds.length === 0) {
      console.log(JSON.stringify({ touchedPapers: 0, migrated: 0, updatedRows: 0 }, null, 2));
      return;
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(options.connectionString);
    const containerClient = blobServiceClient.getContainerClient(options.containerName);
    if (!options.dryRun && !options.skipContainerCreate) {
      await containerClient.createIfNotExists({ access: "blob" });
    }

    const papers = await target.pastPaper.findMany({
      where: {
        id: {
          in: targetPaperIds,
        },
      },
      select: {
        id: true,
        title: true,
        fileUrl: true,
        thumbNailUrl: true,
      },
      orderBy: { id: "asc" },
    });

    const updates: Array<{
      paperId: string;
      fileUrl?: string;
      thumbNailUrl?: string | null;
    }> = [];
    const tasks = papers.flatMap((paper) => {
      const entries: Array<{
        paperId: string;
        field: "fileUrl" | "thumbNailUrl";
        sourceUrl: string;
        destinationUrl: string;
        blobName: string;
      }> = [];

      if (paper.fileUrl && !paper.fileUrl.startsWith(options.publicBaseUrl)) {
        const ext = fileExtension(paper.fileUrl, "application/pdf", ".pdf");
        const blobName = `past-papers/${paper.id}/paper${ext}`;
        entries.push({
          paperId: paper.id,
          field: "fileUrl",
          sourceUrl: paper.fileUrl,
          destinationUrl: `${options.publicBaseUrl}/${blobName}`,
          blobName,
        });
      }

      if (paper.thumbNailUrl && !paper.thumbNailUrl.startsWith(options.publicBaseUrl)) {
        const ext = fileExtension(paper.thumbNailUrl, "image/jpeg", ".jpg");
        const blobName = `past-papers/${paper.id}/thumbnail${ext}`;
        entries.push({
          paperId: paper.id,
          field: "thumbNailUrl",
          sourceUrl: paper.thumbNailUrl,
          destinationUrl: `${options.publicBaseUrl}/${blobName}`,
          blobName,
        });
      }

      return entries;
    });

    let migrated = 0;
    await mapLimit(tasks, options.copyConcurrency, async (task) => {
      const stateKey = `${task.paperId}:${task.field}`;
      const cached = state.records[stateKey];
      if (cached?.sourceUrl === task.sourceUrl && cached.destinationUrl === task.destinationUrl) {
        updates.push({
          paperId: task.paperId,
          ...(task.field === "fileUrl"
            ? { fileUrl: task.destinationUrl }
            : { thumbNailUrl: task.destinationUrl }),
        });
        return;
      }

      if (options.dryRun) {
        migrated += 1;
        return;
      }

      const response = await fetch(task.sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${task.sourceUrl}: ${response.status} ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type");
      const blobClient = containerClient.getBlockBlobClient(task.blobName);
      await blobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: contentType ?? undefined,
        },
      });

      state.records[stateKey] = {
        sourceUrl: task.sourceUrl,
        destinationUrl: task.destinationUrl,
        contentType,
        bytes: buffer.byteLength,
        updatedAt: new Date().toISOString(),
      };
      updates.push({
        paperId: task.paperId,
        ...(task.field === "fileUrl"
          ? { fileUrl: task.destinationUrl }
          : { thumbNailUrl: task.destinationUrl }),
      });
      migrated += 1;
    });

    const mergedUpdates = new Map<string, { fileUrl?: string; thumbNailUrl?: string | null }>();
    for (const update of updates) {
      const current = mergedUpdates.get(update.paperId) ?? {};
      mergedUpdates.set(update.paperId, {
        ...current,
        ...(update.fileUrl ? { fileUrl: update.fileUrl } : {}),
        ...(Object.prototype.hasOwnProperty.call(update, "thumbNailUrl")
          ? { thumbNailUrl: update.thumbNailUrl ?? null }
          : {}),
      });
    }

    let updatedRows = 0;
    if (!options.dryRun) {
      for (const [paperId, payload] of mergedUpdates) {
        await target.pastPaper.update({
          where: { id: paperId },
          data: payload,
        });
        updatedRows += 1;
      }

      state.updatedAt = new Date().toISOString();
      await writeFile(options.stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    }

    const summary = {
      touchedPapers: papers.length,
      assetTasks: tasks.length,
      migrated,
      updatedRows: options.dryRun ? mergedUpdates.size : updatedRows,
      stateFile: options.stateFile,
    };

    const reportPath = path.join(REPORT_DIR, `prod-paper-asset-migration-${timestamp()}.json`);
    await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ...summary, reportPath }, null, 2));
  } finally {
    await target.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
