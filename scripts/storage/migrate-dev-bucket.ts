import os from "node:os";
import path from "node:path";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";

import { createScriptDb, queryRows } from "../lib/db";
import { loadScriptEnv } from "../lib/env";

loadScriptEnv();

type Options = {
    targetBucket: string;
    sourceBucket?: string;
    location: string;
    project?: string;
    gcloudBin?: string;
    dryRun: boolean;
    skipBucketCreate: boolean;
    skipPublicAccess: boolean;
    skipCopy: boolean;
    skipDbUpdate: boolean;
};

type UrlReference = {
    model: "Note" | "PastPaper" | "syllabi";
    field: "fileUrl" | "thumbNailUrl";
    url: string;
    bucket: string;
    objectPath: string;
    directory: string;
};

type CommandOptions = {
    input?: string;
    quiet?: boolean;
};

type CommandResult = {
    code: number;
    stdout: string;
    stderr: string;
};

class CommandError extends Error {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;

    constructor(command: string, result: CommandResult) {
        super(`Command failed (${result.code}): ${command}`);
        this.code = result.code;
        this.stdout = result.stdout;
        this.stderr = result.stderr;
    }
}

function printUsage() {
    console.log(
        [
            "Usage:",
            "  pnpm exec tsx scripts/storage/migrate-dev-bucket.ts --target-bucket=<bucket> [options]",
            "",
            "Options:",
            "  --source-bucket=<bucket>      Override the source bucket detected from DEV_DATABASE URLs.",
            "  --location=<location>         Bucket location for bucket creation. Default: asia-south1",
            "  --project=<project-id>        GCP project to use for bucket creation.",
            "  --gcloud-bin=<path>           Path to the gcloud binary.",
            "  --dry-run                     Print the plan without creating, copying, or updating.",
            "  --skip-bucket-create          Assume the target bucket already exists.",
            "  --skip-public-access          Do not try to grant allUsers objectViewer on the target bucket.",
            "  --skip-copy                   Skip the GCS copy step.",
            "  --skip-db-update              Skip the DEV_DATABASE URL rewrite step.",
            "  --help                        Show this help output.",
        ].join("\n"),
    );
}

function parseArgs(argv: string[]): Options {
    const options: Options = {
        targetBucket: "",
        location: "asia-south1",
        dryRun: false,
        skipBucketCreate: false,
        skipPublicAccess: false,
        skipCopy: false,
        skipDbUpdate: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === "--") {
            continue;
        }

        if (arg === "--help" || arg === "-h") {
            printUsage();
            process.exit(0);
        }

        if (arg === "--dry-run") {
            options.dryRun = true;
            continue;
        }

        if (arg === "--skip-bucket-create") {
            options.skipBucketCreate = true;
            continue;
        }

        if (arg === "--skip-public-access") {
            options.skipPublicAccess = true;
            continue;
        }

        if (arg === "--skip-copy") {
            options.skipCopy = true;
            continue;
        }

        if (arg === "--skip-db-update") {
            options.skipDbUpdate = true;
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
            if (nextArg && nextArg !== "--" && !nextArg.startsWith("--")) {
                value = nextArg.trim();
                index += 1;
            }
        }

        if (!value) {
            throw new Error(`Expected a value for ${flag}`);
        }

        switch (flag) {
            case "--target-bucket":
                options.targetBucket = value;
                break;
            case "--source-bucket":
                options.sourceBucket = value;
                break;
            case "--location":
                options.location = value;
                break;
            case "--project":
                options.project = value;
                break;
            case "--gcloud-bin":
                options.gcloudBin = value;
                break;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    if (!options.targetBucket) {
        throw new Error("Missing required argument --target-bucket=<bucket>");
    }

    if (options.sourceBucket && options.sourceBucket === options.targetBucket) {
        throw new Error("Source and target bucket must be different.");
    }

    return options;
}

function parseGcsUrl(url: string): Omit<UrlReference, "model" | "field"> {
    const parsed = new URL(url);
    const cleanPath = parsed.pathname.replace(/^\/+/, "");

    if (parsed.hostname === "storage.googleapis.com") {
        const [bucket, ...rest] = cleanPath.split("/");
        const objectPath = rest.join("/");
        if (!bucket || !objectPath) {
            throw new Error(`Unsupported GCS URL: ${url}`);
        }
        return {
            url,
            bucket,
            objectPath,
            directory: path.posix.dirname(objectPath) === "." ? "" : path.posix.dirname(objectPath),
        };
    }

    if (parsed.hostname.endsWith(".storage.googleapis.com")) {
        const bucket = parsed.hostname.replace(/\.storage\.googleapis\.com$/, "");
        if (!cleanPath) {
            throw new Error(`Unsupported GCS URL: ${url}`);
        }
        return {
            url,
            bucket,
            objectPath: cleanPath,
            directory: path.posix.dirname(cleanPath) === "." ? "" : path.posix.dirname(cleanPath),
        };
    }

    throw new Error(`Unsupported non-GCS URL: ${url}`);
}

async function resolveGcloudBinary(explicit?: string): Promise<string> {
    const candidates = [
        explicit,
        process.env.GCLOUD_BIN,
        path.join(os.homedir(), "google-cloud-sdk", "bin", "gcloud"),
        "gcloud",
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
        if (candidate === "gcloud") {
            continue;
        }

        try {
            await access(candidate, fsConstants.X_OK);
            return candidate;
        } catch {
            // Try the next candidate.
        }
    }

    return "gcloud";
}

function buildGcloudArgs(options: Options, args: string[]) {
    const withProject = [...args];
    if (options.project) {
        withProject.push(`--project=${options.project}`);
    }
    return withProject;
}

async function runCommand(
    bin: string,
    args: string[],
    options: CommandOptions = {},
): Promise<CommandResult> {
    const commandString = [bin, ...args].join(" ");
    const child = spawn(bin, args, {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
        const text = chunk.toString();
        stdout += text;
        if (!options.quiet) {
            process.stdout.write(text);
        }
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
        const text = chunk.toString();
        stderr += text;
        if (!options.quiet) {
            process.stderr.write(text);
        }
    });

    if (options.input) {
        child.stdin.write(options.input);
    }
    child.stdin.end();

    const code = await new Promise<number>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", (exitCode) => resolve(exitCode ?? 1));
    });

    const result = { code, stdout, stderr };
    if (code !== 0) {
        throw new CommandError(commandString, result);
    }

    return result;
}

async function tryRunCommand(
    bin: string,
    args: string[],
    options: CommandOptions = {},
): Promise<CommandResult | null> {
    try {
        return await runCommand(bin, args, options);
    } catch {
        return null;
    }
}

async function loadReferences() {
    const connectionString = process.env.DEV_DATABASE || process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("Missing DEV_DATABASE or DATABASE_URL in the environment.");
    }

    const database = createScriptDb(connectionString);

    try {
        const [notes, papers, syllabiRows] = await Promise.all([
            queryRows<{ fileUrl: string; thumbNailUrl: string | null }>(
                database.pool,
                'SELECT "fileUrl", "thumbNailUrl" FROM "Note"',
            ),
            queryRows<{ fileUrl: string; thumbNailUrl: string | null }>(
                database.pool,
                'SELECT "fileUrl", "thumbNailUrl" FROM "PastPaper"',
            ),
            queryRows<{ fileUrl: string }>(
                database.pool,
                'SELECT "fileUrl" FROM "syllabi"',
            ),
        ]);

        const references: UrlReference[] = [];

        for (const row of notes) {
            references.push({
                model: "Note",
                field: "fileUrl",
                ...parseGcsUrl(row.fileUrl),
            });
            if (row.thumbNailUrl) {
                references.push({
                    model: "Note",
                    field: "thumbNailUrl",
                    ...parseGcsUrl(row.thumbNailUrl),
                });
            }
        }

        for (const row of papers) {
            references.push({
                model: "PastPaper",
                field: "fileUrl",
                ...parseGcsUrl(row.fileUrl),
            });
            if (row.thumbNailUrl) {
                references.push({
                    model: "PastPaper",
                    field: "thumbNailUrl",
                    ...parseGcsUrl(row.thumbNailUrl),
                });
            }
        }

        for (const row of syllabiRows) {
            references.push({
                model: "syllabi",
                field: "fileUrl",
                ...parseGcsUrl(row.fileUrl),
            });
        }

        return { ...database, references };
    } catch (error) {
        await database.close();
        throw error;
    }
}

type DevBucketConnection = Awaited<ReturnType<typeof loadReferences>>;

function summarizeReferences(references: UrlReference[]) {
    const bucketCounts = new Map<string, number>();
    const directories = new Map<string, Set<string>>();

    for (const reference of references) {
        bucketCounts.set(reference.bucket, (bucketCounts.get(reference.bucket) || 0) + 1);

        const key = reference.directory;
        if (!directories.has(key)) {
            directories.set(key, new Set<string>());
        }
        directories.get(key)!.add(reference.objectPath);
    }

    return {
        bucketCounts,
        directories,
    };
}

async function ensureTargetBucket(
    gcloudBin: string,
    options: Options,
    targetBucket: string,
) {
    if (options.skipBucketCreate) {
        console.log(`Skipping bucket creation for gs://${targetBucket}.`);
        return;
    }

    const bucketUrl = `gs://${targetBucket}`;
    const exists = await tryRunCommand(
        gcloudBin,
        buildGcloudArgs(options, ["storage", "ls", bucketUrl]),
        { quiet: true },
    );

    if (exists) {
        console.log(`Bucket already exists: ${bucketUrl}`);
        return;
    }

    console.log(`Creating ${bucketUrl} in ${options.location}...`);
    await runCommand(
        gcloudBin,
        buildGcloudArgs(options, [
            "storage",
            "buckets",
            "create",
            bucketUrl,
            `--location=${options.location}`,
            "--uniform-bucket-level-access",
        ]),
    );
}

async function ensurePublicAccess(
    gcloudBin: string,
    options: Options,
    targetBucket: string,
) {
    if (options.skipPublicAccess) {
        console.log(`Skipping public IAM binding for gs://${targetBucket}.`);
        return;
    }

    console.log(`Granting allUsers objectViewer on gs://${targetBucket}...`);
    await runCommand(
        gcloudBin,
        buildGcloudArgs(options, [
            "storage",
            "buckets",
            "add-iam-policy-binding",
            `gs://${targetBucket}`,
            "--member=allUsers",
            "--role=roles/storage.objectViewer",
        ]),
    );
}

async function copyReferencedObjects(
    gcloudBin: string,
    options: Options,
    sourceBucket: string,
    targetBucket: string,
    directories: Map<string, Set<string>>,
) {
    if (options.skipCopy) {
        console.log("Skipping GCS copy step.");
        return;
    }

    const orderedDirectories = [...directories.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
    );

    for (const [directory, objectPaths] of orderedDirectories) {
        const destination = directory
            ? `gs://${targetBucket}/${directory}/`
            : `gs://${targetBucket}/`;
        const input = [...objectPaths]
            .sort((left, right) => left.localeCompare(right))
            .map((objectPath) => `gs://${sourceBucket}/${objectPath}`)
            .join("\n");

        console.log(
            `Copying ${objectPaths.size} object(s) from ${directory || "(root)"} to ${destination}`,
        );
        await runCommand(
            gcloudBin,
            buildGcloudArgs(options, ["storage", "cp", "-I", destination]),
            { input: `${input}\n` },
        );
    }
}

async function rewriteDatabaseUrls(
    connection: DevBucketConnection,
    sourceBucket: string,
    targetBucket: string,
    options: Options,
) {
    if (options.skipDbUpdate) {
        console.log("Skipping DEV_DATABASE URL rewrite.");
        return;
    }

    const oldPrefix = `https://storage.googleapis.com/${sourceBucket}/`;
    const newPrefix = `https://storage.googleapis.com/${targetBucket}/`;
    const oldLike = `${oldPrefix}%`;

    const countsBefore = {
        noteFileUrls: Number((await queryRows<{ count: number }>(
            connection.pool,
            'SELECT COUNT(*)::INT AS count FROM "Note" WHERE "fileUrl" LIKE $1',
            [oldLike],
        ))[0]?.count ?? 0),
        noteThumbUrls: Number((await queryRows<{ count: number }>(
            connection.pool,
            'SELECT COUNT(*)::INT AS count FROM "Note" WHERE "thumbNailUrl" LIKE $1',
            [oldLike],
        ))[0]?.count ?? 0),
        paperFileUrls: Number((await queryRows<{ count: number }>(
            connection.pool,
            'SELECT COUNT(*)::INT AS count FROM "PastPaper" WHERE "fileUrl" LIKE $1',
            [oldLike],
        ))[0]?.count ?? 0),
        paperThumbUrls: Number((await queryRows<{ count: number }>(
            connection.pool,
            'SELECT COUNT(*)::INT AS count FROM "PastPaper" WHERE "thumbNailUrl" LIKE $1',
            [oldLike],
        ))[0]?.count ?? 0),
        syllabiFileUrls: Number((await queryRows<{ count: number }>(
            connection.pool,
            'SELECT COUNT(*)::INT AS count FROM "syllabi" WHERE "fileUrl" LIKE $1',
            [oldLike],
        ))[0]?.count ?? 0),
    };

    console.log("DB rows matched for URL rewrite:");
    console.table(countsBefore);

    const client = await connection.pool.connect();
    let results: number[] = [];
    try {
        await client.query("BEGIN");
        results = [
            (
                await client.query(
                    'UPDATE "Note" SET "fileUrl" = replace("fileUrl", $1, $2) WHERE "fileUrl" LIKE $3',
                    [oldPrefix, newPrefix, oldLike],
                )
            ).rowCount ?? 0,
            (
                await client.query(
                    'UPDATE "Note" SET "thumbNailUrl" = replace("thumbNailUrl", $1, $2) WHERE "thumbNailUrl" LIKE $3',
                    [oldPrefix, newPrefix, oldLike],
                )
            ).rowCount ?? 0,
            (
                await client.query(
                    'UPDATE "PastPaper" SET "fileUrl" = replace("fileUrl", $1, $2) WHERE "fileUrl" LIKE $3',
                    [oldPrefix, newPrefix, oldLike],
                )
            ).rowCount ?? 0,
            (
                await client.query(
                    'UPDATE "PastPaper" SET "thumbNailUrl" = replace("thumbNailUrl", $1, $2) WHERE "thumbNailUrl" LIKE $3',
                    [oldPrefix, newPrefix, oldLike],
                )
            ).rowCount ?? 0,
            (
                await client.query(
                    'UPDATE "syllabi" SET "fileUrl" = replace("fileUrl", $1, $2) WHERE "fileUrl" LIKE $3',
                    [oldPrefix, newPrefix, oldLike],
                )
            ).rowCount ?? 0,
        ];
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    console.log("DB rows updated:");
    console.table({
        noteFileUrls: results[0],
        noteThumbUrls: results[1],
        paperFileUrls: results[2],
        paperThumbUrls: results[3],
        syllabiFileUrls: results[4],
    });

    const countsAfter = {
        noteFileUrls: Number((await queryRows<{ count: number }>(
            connection.pool,
            'SELECT COUNT(*)::INT AS count FROM "Note" WHERE "fileUrl" LIKE $1',
            [`${newPrefix}%`],
        ))[0]?.count ?? 0),
        noteThumbUrls: Number((await queryRows<{ count: number }>(
            connection.pool,
            'SELECT COUNT(*)::INT AS count FROM "Note" WHERE "thumbNailUrl" LIKE $1',
            [`${newPrefix}%`],
        ))[0]?.count ?? 0),
        paperFileUrls: Number((await queryRows<{ count: number }>(
            connection.pool,
            'SELECT COUNT(*)::INT AS count FROM "PastPaper" WHERE "fileUrl" LIKE $1',
            [`${newPrefix}%`],
        ))[0]?.count ?? 0),
        paperThumbUrls: Number((await queryRows<{ count: number }>(
            connection.pool,
            'SELECT COUNT(*)::INT AS count FROM "PastPaper" WHERE "thumbNailUrl" LIKE $1',
            [`${newPrefix}%`],
        ))[0]?.count ?? 0),
        syllabiFileUrls: Number((await queryRows<{ count: number }>(
            connection.pool,
            'SELECT COUNT(*)::INT AS count FROM "syllabi" WHERE "fileUrl" LIKE $1',
            [`${newPrefix}%`],
        ))[0]?.count ?? 0),
    };

    console.log("DB rows now pointing at the target bucket:");
    console.table(countsAfter);
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const gcloudBin = await resolveGcloudBinary(options.gcloudBin);
    const connection = await loadReferences();
    const { references } = connection;

    try {
        if (references.length === 0) {
            console.log("No DEV_DATABASE GCS URLs found. Nothing to migrate.");
            return;
        }

        const { bucketCounts, directories } = summarizeReferences(references);
        const detectedBuckets = [...bucketCounts.keys()].sort();
        const sourceBucket = options.sourceBucket ?? detectedBuckets[0];

        if (!options.sourceBucket && detectedBuckets.length > 1) {
            throw new Error(
                `Found multiple source buckets in DEV_DATABASE (${detectedBuckets.join(", ")}). Re-run with --source-bucket=<bucket>.`,
            );
        }

        if (sourceBucket === options.targetBucket) {
            throw new Error("Source and target bucket must be different.");
        }

        const filteredReferences = references.filter((reference) => reference.bucket === sourceBucket);
        if (filteredReferences.length === 0) {
            throw new Error(`No DEV_DATABASE URLs matched source bucket "${sourceBucket}".`);
        }

        const filteredSummary = summarizeReferences(filteredReferences);

        console.log("Migration plan:");
        console.table({
            sourceBucket,
            targetBucket: options.targetBucket,
            location: options.location,
            gcloudBin,
            referencedUrls: filteredReferences.length,
            uniqueObjects: filteredSummary.directories.size
                ? [...filteredSummary.directories.values()].reduce(
                    (count, objectPaths) => count + objectPaths.size,
                    0,
                )
                : 0,
            directories: filteredSummary.directories.size,
            dryRun: options.dryRun,
        });

        console.log("Referenced bucket counts:");
        console.table(
            Object.fromEntries(
                [...bucketCounts.entries()].sort(([left], [right]) => left.localeCompare(right)),
            ),
        );

        if (options.dryRun) {
            console.log("Dry run only. No bucket, copy, or database changes were applied.");
            return;
        }

        await ensureTargetBucket(gcloudBin, options, options.targetBucket);
        await ensurePublicAccess(gcloudBin, options, options.targetBucket);
        await copyReferencedObjects(
            gcloudBin,
            options,
            sourceBucket,
            options.targetBucket,
            filteredSummary.directories,
        );
        await rewriteDatabaseUrls(connection, sourceBucket, options.targetBucket, options);

        console.log("Migration complete.");
    } finally {
        await connection.close();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
