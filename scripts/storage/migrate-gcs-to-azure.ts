import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import dotenv from "dotenv";
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { PrismaPg } from "@prisma/adapter-pg";

import * as prismaClient from "../../prisma/generated/client";

const { PrismaClient, Prisma } = prismaClient;

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true, quiet: true });

type ModelName = "Note" | "PastPaper" | "syllabi";
type FieldName = "fileUrl" | "thumbNailUrl";
type PathPrefixMode = "auto" | "none" | "source-bucket";
type PublicAccess = "blob" | "container" | "none";

type Options = {
    databaseUrl: string;
    connectionString: string;
    containerName: string;
    publicBaseUrl?: string;
    stateFile: string;
    pathPrefixMode: PathPrefixMode;
    publicAccess: PublicAccess;
    copyConcurrency: number;
    uploadBufferSize: number;
    uploadConcurrency: number;
    sourceRequestTimeoutMs: number;
    dbBatchSize: number;
    dryRun: boolean;
    skipContainerCreate: boolean;
    skipCopy: boolean;
    skipDbUpdate: boolean;
};

type ParsedGcsUrl = {
    bucket: string;
    objectPath: string;
    canonicalUrl: string;
    preservedQuery: string;
    strippedQueryKeys: string[];
};

type ParsedSourceUrl = {
    sourceBucket: string;
    objectPath: string;
    canonicalUrl: string;
    preservedQuery: string;
    strippedQueryKeys: string[];
};

type SkippedReference = {
    model: ModelName;
    id: string;
    field: FieldName;
    url: string;
    hostname: string;
};

type UrlReference = {
    model: ModelName;
    id: string;
    field: FieldName;
    currentUrl: string;
    sourceBucket: string;
    objectPath: string;
    preservedQuery: string;
    strippedQueryKeys: string[];
    sourceUrlCandidates: string[];
    destinationBlobName: string;
    destinationUrl: string;
};

type ObjectTask = {
    key: string;
    sourceBucket: string;
    objectPath: string;
    destinationBlobName: string;
    destinationUrl: string;
    sourceUrlCandidates: string[];
    references: number;
};

type UpdateInstruction = {
    model: ModelName;
    field: FieldName;
    id: string;
    currentUrl: string;
    nextUrl: string;
};

type ObjectStateRecord = {
    sourceBucket: string;
    objectPath: string;
    destinationBlobName: string;
    destinationUrl: string;
    sourceUrl: string;
    bytes: number;
    sha256: string;
    contentType: string | null;
    etag: string | null;
    copiedAt: string;
};

type MigrationState = {
    version: 1;
    createdAt: string;
    updatedAt: string;
    containerName: string;
    publicBaseUrl: string;
    pathPrefixMode: Exclude<PathPrefixMode, "auto">;
    objects: Record<string, ObjectStateRecord>;
    dbRewrite?: {
        completedAt: string;
        updatedRows: number;
    };
};

type BulkUpdateGroup = {
    model: ModelName;
    field: FieldName;
    rows: UpdateInstruction[];
};

type TableNameMap = Record<ModelName, string>;
type ColumnNameMap = Record<FieldName, string>;

const TABLE_NAMES: TableNameMap = {
    Note: `"Note"`,
    PastPaper: `"PastPaper"`,
    syllabi: `"syllabi"`,
};

const COLUMN_NAMES: ColumnNameMap = {
    fileUrl: `"fileUrl"`,
    thumbNailUrl: `"thumbNailUrl"`,
};

const GCS_SIGNING_QUERY_PARAM_KEYS = new Set([
    "googleaccessid",
    "expires",
    "signature",
]);
const SKIPPED_SOURCE_HOSTNAMES = new Set(["ec-syllabus.acmvit.in"]);

const DEFAULT_STATE_DIR = path.resolve(process.cwd(), "scripts/reports");
const DEFAULT_COPY_CONCURRENCY = 3;
const DEFAULT_UPLOAD_BUFFER_SIZE = 8 * 1024 * 1024;
const DEFAULT_UPLOAD_CONCURRENCY = 3;
const DEFAULT_SOURCE_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_SOURCE_FETCH_RETRIES = 3;
const DEFAULT_DB_BATCH_SIZE = 200;

function printUsage() {
    console.log(
        [
            "Usage:",
            "  pnpm exec tsx scripts/storage/migrate-gcs-to-azure.ts [options]",
            "",
            "Required configuration:",
            "  DATABASE_URL                     Source Cockroach/Postgres URL.",
            "  AZURE_STORAGE_CONNECTION_STRING  Azure storage connection string.",
            "  AZURE_STORAGE_CONTAINER          Destination Azure blob container.",
            "",
            "Optional configuration:",
            "  AZURE_BLOB_PUBLIC_BASE_URL       Public base URL for the container root.",
            "",
            "Options:",
            "  --database-url=<url>             Override DATABASE_URL from the environment.",
            "  --connection-string=<value>      Override AZURE_STORAGE_CONNECTION_STRING.",
            "  --container=<name>               Override AZURE_STORAGE_CONTAINER.",
            "  --public-base-url=<url>          Override AZURE_BLOB_PUBLIC_BASE_URL.",
            "  --state-file=<path>              Persist verified copy state here.",
            "  --path-prefix-mode=<mode>        auto | none | source-bucket. Default: auto",
            "  --public-access=<level>          blob | container | none. Default: blob",
            `  --copy-concurrency=<n>           Default: ${DEFAULT_COPY_CONCURRENCY}`,
            `  --upload-buffer-size=<bytes>     Default: ${DEFAULT_UPLOAD_BUFFER_SIZE}`,
            `  --upload-concurrency=<n>         Default: ${DEFAULT_UPLOAD_CONCURRENCY}`,
            `  --source-timeout-ms=<ms>         Default: ${DEFAULT_SOURCE_TIMEOUT_MS}`,
            `  --db-batch-size=<n>              Default: ${DEFAULT_DB_BATCH_SIZE}`,
            "  --dry-run                        Print the migration plan only.",
            "  --skip-container-create          Assume the destination container already exists.",
            "  --skip-copy                      Reuse previously verified state; do not upload blobs.",
            "  --skip-db-update                 Do not rewrite DATABASE_URL rows.",
            "  --help                           Show this help output.",
            "",
            "Notes:",
            "  - State defaults to scripts/reports/gcs-to-azure-<container>.state.json.",
            "  - --skip-copy is intentionally strict: it requires previously verified state",
            "    for every destination blob before the database rewrite is allowed.",
        ].join("\n"),
    );
}

function parseIntegerFlag(flag: string, value: string, minimum: number) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < minimum) {
        throw new Error(`${flag} must be an integer >= ${minimum}. Received: ${value}`);
    }
    return parsed;
}

function parseArgs(argv: string[]): Options {
    const envContainer = process.env.AZURE_STORAGE_CONTAINER?.trim();
    const containerName = envContainer || "";
    const stateFile = path.resolve(
        DEFAULT_STATE_DIR,
        `gcs-to-azure-${(containerName || "pending-container").replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.state.json`,
    );

    const options: Options = {
        databaseUrl: process.env.DATABASE_URL?.trim() || "",
        connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING?.trim() || "",
        containerName,
        publicBaseUrl: process.env.AZURE_BLOB_PUBLIC_BASE_URL?.trim() || undefined,
        stateFile,
        pathPrefixMode: "auto",
        publicAccess: "blob",
        copyConcurrency: DEFAULT_COPY_CONCURRENCY,
        uploadBufferSize: DEFAULT_UPLOAD_BUFFER_SIZE,
        uploadConcurrency: DEFAULT_UPLOAD_CONCURRENCY,
        sourceRequestTimeoutMs: DEFAULT_SOURCE_TIMEOUT_MS,
        dbBatchSize: DEFAULT_DB_BATCH_SIZE,
        dryRun: false,
        skipContainerCreate: false,
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

        if (arg === "--skip-container-create") {
            options.skipContainerCreate = true;
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
            const separatorIndex = arg.indexOf("=");
            const flagPart = arg.slice(0, separatorIndex);
            const valuePart = arg.slice(separatorIndex + 1);
            flag = flagPart;
            value = valuePart.trim();
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
            case "--database-url":
                options.databaseUrl = value;
                break;
            case "--connection-string":
                options.connectionString = value;
                break;
            case "--container":
                options.containerName = value;
                options.stateFile = path.resolve(
                    DEFAULT_STATE_DIR,
                    `gcs-to-azure-${value.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.state.json`,
                );
                break;
            case "--public-base-url":
                options.publicBaseUrl = value;
                break;
            case "--state-file":
                options.stateFile = path.resolve(process.cwd(), value);
                break;
            case "--path-prefix-mode":
                if (value !== "auto" && value !== "none" && value !== "source-bucket") {
                    throw new Error(`Unsupported --path-prefix-mode value: ${value}`);
                }
                options.pathPrefixMode = value;
                break;
            case "--public-access":
                if (value !== "blob" && value !== "container" && value !== "none") {
                    throw new Error(`Unsupported --public-access value: ${value}`);
                }
                options.publicAccess = value;
                break;
            case "--copy-concurrency":
                options.copyConcurrency = parseIntegerFlag(flag, value, 1);
                break;
            case "--upload-buffer-size":
                options.uploadBufferSize = parseIntegerFlag(flag, value, 1);
                break;
            case "--upload-concurrency":
                options.uploadConcurrency = parseIntegerFlag(flag, value, 1);
                break;
            case "--source-timeout-ms":
                options.sourceRequestTimeoutMs = parseIntegerFlag(flag, value, 1_000);
                break;
            case "--db-batch-size":
                options.dbBatchSize = parseIntegerFlag(flag, value, 1);
                break;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    if (!options.databaseUrl) {
        throw new Error("Missing DATABASE_URL. Set it in .env or pass --database-url.");
    }

    if (!options.containerName) {
        throw new Error("Missing AZURE_STORAGE_CONTAINER. Set it in .env or pass --container.");
    }

    if (!options.connectionString && !options.dryRun) {
        throw new Error(
            "Missing AZURE_STORAGE_CONNECTION_STRING. Set it in .env or pass --connection-string.",
        );
    }

    if (!options.connectionString && !options.publicBaseUrl) {
        throw new Error(
            "Provide either AZURE_STORAGE_CONNECTION_STRING or AZURE_BLOB_PUBLIC_BASE_URL so destination URLs can be derived.",
        );
    }

    return options;
}

function validatePublicBaseUrl(baseUrl: string | undefined) {
    if (!baseUrl) {
        return;
    }

    const parsed = new URL(baseUrl);
    if (parsed.search || parsed.hash) {
        throw new Error("Public base URL must not include a query string or hash fragment.");
    }
}

function encodePathSegments(input: string) {
    return input
        .split("/")
        .filter((segment) => segment.length > 0)
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

function buildGcsPublicUrl(bucket: string, objectPath: string) {
    const encodedPath = encodePathSegments(objectPath);
    return `https://storage.googleapis.com/${bucket}/${encodedPath}`;
}

function getUrlHostname(url: string) {
    return new URL(url).hostname.toLowerCase();
}

function shouldSkipSourceHostname(hostname: string) {
    return SKIPPED_SOURCE_HOSTNAMES.has(hostname.toLowerCase());
}

function shouldSkipSourceUrl(url: string) {
    try {
        return shouldSkipSourceHostname(getUrlHostname(url));
    } catch {
        return false;
    }
}

function buildDestinationUrl(baseUrl: string, blobName: string, preservedQuery: string) {
    const parsedBase = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    const basePath = parsedBase.pathname.replace(/\/+$/, "");
    const encodedBlobName = encodePathSegments(blobName);
    parsedBase.pathname = basePath ? `${basePath}/${encodedBlobName}` : `/${encodedBlobName}`;
    parsedBase.search = preservedQuery.startsWith("?") ? preservedQuery.slice(1) : preservedQuery;
    parsedBase.hash = "";
    return parsedBase.toString();
}

function normalizeBaseUrl(baseUrl: string) {
    const parsed = new URL(baseUrl);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
}

function isTargetAzureUrl(url: string, baseUrl: string) {
    try {
        const parsedUrl = new URL(url);
        const parsedBase = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
        const basePath = parsedBase.pathname.replace(/\/+$/, "");
        const baseOriginMatches = parsedUrl.origin === parsedBase.origin;
        if (!baseOriginMatches) {
            return false;
        }
        if (!basePath) {
            return true;
        }
        return (
            parsedUrl.pathname === basePath ||
            parsedUrl.pathname.startsWith(`${basePath}/`)
        );
    } catch {
        return false;
    }
}

function parseGcsUrl(url: string): ParsedGcsUrl {
    const parsed = new URL(url);
    const pathSegments = parsed.pathname
        .replace(/^\/+/, "")
        .split("/")
        .filter((segment) => segment.length > 0)
        .map((segment) => decodeURIComponent(segment));

    let bucket = "";
    let objectSegments: string[] = [];

    if (parsed.hostname === "storage.googleapis.com") {
        [bucket, ...objectSegments] = pathSegments;
    } else if (parsed.hostname.endsWith(".storage.googleapis.com")) {
        bucket = parsed.hostname.replace(/\.storage\.googleapis\.com$/, "");
        objectSegments = pathSegments;
    } else {
        throw new Error(`Unsupported non-GCS URL: ${url}`);
    }

    if (!bucket || objectSegments.length === 0) {
        throw new Error(`Unsupported GCS URL shape: ${url}`);
    }

    const preserved = new URLSearchParams();
    const strippedQueryKeys: string[] = [];

    for (const [key, value] of parsed.searchParams.entries()) {
        const normalizedKey = key.toLowerCase();
        if (
            GCS_SIGNING_QUERY_PARAM_KEYS.has(normalizedKey) ||
            normalizedKey.startsWith("x-goog-")
        ) {
            strippedQueryKeys.push(key);
            continue;
        }

        preserved.append(key, value);
    }

    const objectPath = objectSegments.join("/");

    return {
        bucket,
        objectPath,
        canonicalUrl: buildGcsPublicUrl(bucket, objectPath),
        preservedQuery: preserved.toString() ? `?${preserved.toString()}` : "",
        strippedQueryKeys: [...new Set(strippedQueryKeys)].sort(),
    };
}

function parseSourceUrl(url: string): ParsedSourceUrl {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(`Unsupported protocol for source URL: ${url}`);
    }

    try {
        const gcs = parseGcsUrl(url);
        return {
            sourceBucket: gcs.bucket,
            objectPath: gcs.objectPath,
            canonicalUrl: gcs.canonicalUrl,
            preservedQuery: gcs.preservedQuery,
            strippedQueryKeys: gcs.strippedQueryKeys,
        };
    } catch {
        const objectSegments = parsed.pathname
            .replace(/^\/+/, "")
            .split("/")
            .filter((segment) => segment.length > 0)
            .map((segment) => decodeURIComponent(segment));

        if (objectSegments.length === 0) {
            throw new Error(`Unsupported public URL shape: ${url}`);
        }

        parsed.hash = "";

        return {
            sourceBucket: `external/${parsed.hostname.toLowerCase()}`,
            objectPath: objectSegments.join("/"),
            canonicalUrl: parsed.toString(),
            preservedQuery: parsed.search,
            strippedQueryKeys: [],
        };
    }
}

function resolvePathPrefixMode(
    requestedMode: PathPrefixMode,
    sourceBuckets: string[],
): Exclude<PathPrefixMode, "auto"> {
    if (requestedMode !== "auto") {
        return requestedMode;
    }

    return sourceBuckets.length > 1 ? "source-bucket" : "none";
}

function buildDestinationBlobName(
    mode: Exclude<PathPrefixMode, "auto">,
    bucket: string,
    objectPath: string,
) {
    const cleanObjectPath = objectPath.replace(/^\/+/, "");
    return mode === "source-bucket"
        ? `${bucket}/${cleanObjectPath}`
        : cleanObjectPath;
}

function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes < 1024) {
        return `${bytes} B`;
    }

    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = -1;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 1 : 2)} ${units[unitIndex]}`;
}

class CountingHashStream extends Transform {
    bytes = 0;
    private readonly hash = createHash("sha256");

    override _transform(
        chunk: Buffer | string,
        _encoding: BufferEncoding,
        callback: (error?: Error | null, data?: Buffer) => void,
    ) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        this.bytes += buffer.length;
        this.hash.update(buffer);
        callback(null, buffer);
    }

    digestHex() {
        return this.hash.digest("hex");
    }
}

async function writeJsonAtomically(filePath: string, value: unknown) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random()
        .toString(16)
        .slice(2)}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(tempPath, filePath);
}

let persistStateChain = Promise.resolve();

async function loadState(
    filePath: string,
    containerName: string,
    publicBaseUrl: string,
    pathPrefixMode: Exclude<PathPrefixMode, "auto">,
): Promise<MigrationState> {
    try {
        const raw = await readFile(filePath, "utf8");
        const parsed = JSON.parse(raw) as MigrationState;

        if (parsed.version !== 1) {
            throw new Error(`Unsupported state file version in ${filePath}.`);
        }

        if (
            parsed.containerName !== containerName ||
            normalizeBaseUrl(parsed.publicBaseUrl) !== normalizeBaseUrl(publicBaseUrl) ||
            parsed.pathPrefixMode !== pathPrefixMode
        ) {
            throw new Error(
                `State file ${filePath} does not match the current container/base-url/path-prefix configuration.`,
            );
        }

        return parsed;
    } catch (error) {
        if (
            error instanceof Error &&
            "code" in error &&
            (error as NodeJS.ErrnoException).code === "ENOENT"
        ) {
            const now = new Date().toISOString();
            return {
                version: 1,
                createdAt: now,
                updatedAt: now,
                containerName,
                publicBaseUrl,
                pathPrefixMode,
                objects: {},
            };
        }

        throw error;
    }
}

async function loadPersistedPathPrefixMode(
    filePath: string,
    containerName: string,
    publicBaseUrl: string,
): Promise<Exclude<PathPrefixMode, "auto"> | null> {
    try {
        const raw = await readFile(filePath, "utf8");
        const parsed = JSON.parse(raw) as MigrationState;

        if (parsed.version !== 1) {
            throw new Error(`Unsupported state file version in ${filePath}.`);
        }

        if (
            parsed.containerName !== containerName ||
            normalizeBaseUrl(parsed.publicBaseUrl) !== normalizeBaseUrl(publicBaseUrl)
        ) {
            throw new Error(
                `State file ${filePath} does not match the current container/base-url configuration.`,
            );
        }

        return parsed.pathPrefixMode;
    } catch (error) {
        if (
            error instanceof Error &&
            "code" in error &&
            (error as NodeJS.ErrnoException).code === "ENOENT"
        ) {
            return null;
        }

        throw error;
    }
}

async function persistState(filePath: string, state: MigrationState) {
    const runPersist = async () => {
        state.updatedAt = new Date().toISOString();
        await writeJsonAtomically(filePath, state);
    };

    const nextPersist = persistStateChain.then(runPersist, runPersist);
    persistStateChain = nextPersist.then(
        () => undefined,
        () => undefined,
    );

    await nextPersist;
}

function buildPrismaClient(databaseUrl: string) {
    return new PrismaClient({
        adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
}

async function loadReferences(
    prisma: InstanceType<typeof PrismaClient>,
    destinationBaseUrl: string,
    pathPrefixMode: Exclude<PathPrefixMode, "auto">,
) {
    const [notes, papers, syllabiRows] = await Promise.all([
        prisma.note.findMany({
            select: {
                id: true,
                fileUrl: true,
                thumbNailUrl: true,
            },
        }),
        prisma.pastPaper.findMany({
            select: {
                id: true,
                fileUrl: true,
                thumbNailUrl: true,
            },
        }),
        prisma.syllabi.findMany({
            select: {
                id: true,
                fileUrl: true,
            },
        }),
    ]);

    const references: UrlReference[] = [];
    const alreadyTarget = {
        noteFileUrls: 0,
        noteThumbUrls: 0,
        paperFileUrls: 0,
        paperThumbUrls: 0,
        syllabiFileUrls: 0,
    };
    const unsupported: Array<{ model: ModelName; id: string; field: FieldName; url: string }> = [];
    const skipped: SkippedReference[] = [];
    const sourceBuckets = new Set<string>();

    const addReference = (
        model: ModelName,
        id: string,
        field: FieldName,
        url: string | null | undefined,
    ) => {
        if (!url) {
            return;
        }

        if (isTargetAzureUrl(url, destinationBaseUrl)) {
            if (model === "Note" && field === "fileUrl") alreadyTarget.noteFileUrls += 1;
            if (model === "Note" && field === "thumbNailUrl") alreadyTarget.noteThumbUrls += 1;
            if (model === "PastPaper" && field === "fileUrl") alreadyTarget.paperFileUrls += 1;
            if (model === "PastPaper" && field === "thumbNailUrl") alreadyTarget.paperThumbUrls += 1;
            if (model === "syllabi" && field === "fileUrl") alreadyTarget.syllabiFileUrls += 1;
            return;
        }

        if (shouldSkipSourceUrl(url)) {
            skipped.push({
                model,
                id,
                field,
                url,
                hostname: getUrlHostname(url),
            });
            return;
        }

        try {
            const parsed = parseSourceUrl(url);
            sourceBuckets.add(parsed.sourceBucket);
            const destinationBlobName = buildDestinationBlobName(
                pathPrefixMode,
                parsed.sourceBucket,
                parsed.objectPath,
            );

            references.push({
                model,
                id,
                field,
                currentUrl: url,
                sourceBucket: parsed.sourceBucket,
                objectPath: parsed.objectPath,
                preservedQuery: parsed.preservedQuery,
                strippedQueryKeys: parsed.strippedQueryKeys,
                sourceUrlCandidates: [...new Set([url, parsed.canonicalUrl])],
                destinationBlobName,
                destinationUrl: buildDestinationUrl(
                    destinationBaseUrl,
                    destinationBlobName,
                    parsed.preservedQuery,
                ),
            });
        } catch {
            unsupported.push({ model, id, field, url });
        }
    };

    for (const note of notes) {
        addReference("Note", note.id, "fileUrl", note.fileUrl);
        addReference("Note", note.id, "thumbNailUrl", note.thumbNailUrl);
    }

    for (const paper of papers) {
        addReference("PastPaper", paper.id, "fileUrl", paper.fileUrl);
        addReference("PastPaper", paper.id, "thumbNailUrl", paper.thumbNailUrl);
    }

    for (const syllabiRow of syllabiRows) {
        addReference("syllabi", syllabiRow.id, "fileUrl", syllabiRow.fileUrl);
    }

    return {
        references,
        alreadyTarget,
        unsupported,
        skipped,
        sourceBuckets: [...sourceBuckets].sort(),
        totalRows: {
            notes: notes.length,
            papers: papers.length,
            syllabi: syllabiRows.length,
        },
    };
}

function ensureNoCrossBucketCollisions(
    pathPrefixMode: Exclude<PathPrefixMode, "auto">,
    references: UrlReference[],
) {
    if (pathPrefixMode !== "none") {
        return;
    }

    const objectPathToBucket = new Map<string, string>();
    for (const reference of references) {
        const existingBucket = objectPathToBucket.get(reference.objectPath);
        if (existingBucket && existingBucket !== reference.sourceBucket) {
            throw new Error(
                `Object path collision detected across source buckets for "${reference.objectPath}". Re-run with --path-prefix-mode=source-bucket.`,
            );
        }
        objectPathToBucket.set(reference.objectPath, reference.sourceBucket);
    }
}

function buildObjectTasks(references: UrlReference[], publicBaseUrl: string) {
    const tasks = new Map<string, ObjectTask>();

    for (const reference of references) {
        const key = `${reference.sourceBucket}\u0000${reference.objectPath}`;
        const existing = tasks.get(key);

        if (!existing) {
            tasks.set(key, {
                key,
                sourceBucket: reference.sourceBucket,
                objectPath: reference.objectPath,
                destinationBlobName: reference.destinationBlobName,
                destinationUrl: buildDestinationUrl(
                    publicBaseUrl,
                    reference.destinationBlobName,
                    "",
                ),
                sourceUrlCandidates: [...reference.sourceUrlCandidates],
                references: 1,
            });
            continue;
        }

        existing.references += 1;
        existing.sourceUrlCandidates = [
            ...new Set([...existing.sourceUrlCandidates, ...reference.sourceUrlCandidates]),
        ];
    }

    return [...tasks.values()];
}

function summarizeReferences(references: UrlReference[]) {
    const bucketCounts = new Map<string, number>();
    const modelFieldCounts = new Map<string, number>();
    let strippedSigningQueryRefs = 0;
    const strippedKeys = new Map<string, number>();

    for (const reference of references) {
        bucketCounts.set(reference.sourceBucket, (bucketCounts.get(reference.sourceBucket) || 0) + 1);

        const modelFieldKey = `${reference.model}.${reference.field}`;
        modelFieldCounts.set(modelFieldKey, (modelFieldCounts.get(modelFieldKey) || 0) + 1);

        if (reference.strippedQueryKeys.length > 0) {
            strippedSigningQueryRefs += 1;
            for (const key of reference.strippedQueryKeys) {
                strippedKeys.set(key, (strippedKeys.get(key) || 0) + 1);
            }
        }
    }

    return {
        bucketCounts: Object.fromEntries([...bucketCounts.entries()].sort()),
        modelFieldCounts: Object.fromEntries([...modelFieldCounts.entries()].sort()),
        strippedSigningQueryRefs,
        strippedKeys: Object.fromEntries([...strippedKeys.entries()].sort()),
    };
}

function summarizeSkippedReferences(skipped: SkippedReference[]) {
    const hostCounts = new Map<string, number>();
    const modelFieldCounts = new Map<string, number>();

    for (const reference of skipped) {
        hostCounts.set(reference.hostname, (hostCounts.get(reference.hostname) || 0) + 1);
        const modelFieldKey = `${reference.model}.${reference.field}`;
        modelFieldCounts.set(modelFieldKey, (modelFieldCounts.get(modelFieldKey) || 0) + 1);
    }

    return {
        hostCounts: Object.fromEntries([...hostCounts.entries()].sort()),
        modelFieldCounts: Object.fromEntries([...modelFieldCounts.entries()].sort()),
    };
}

async function ensureContainer(containerClient: ContainerClient, options: Options) {
    if (!options.skipContainerCreate) {
        console.log(`Ensuring Azure container exists: ${containerClient.containerName}`);
        await containerClient.createIfNotExists({
            access: options.publicAccess === "none" ? undefined : options.publicAccess,
        });
    } else {
        console.log(`Skipping container creation for ${containerClient.containerName}.`);
        const exists = await containerClient.exists();
        if (!exists) {
            throw new Error(
                `Azure container ${containerClient.containerName} does not exist and --skip-container-create was set.`,
            );
        }
    }

    if (options.publicAccess !== "none") {
        console.log(
            `Ensuring anonymous ${options.publicAccess} access on ${containerClient.containerName}.`,
        );
        await containerClient.setAccessPolicy(options.publicAccess);
    }
}

async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryFetchSource(task: ObjectTask, timeoutMs: number) {
    const failures: string[] = [];

    for (const candidate of task.sourceUrlCandidates) {
        for (let attempt = 1; attempt <= DEFAULT_SOURCE_FETCH_RETRIES; attempt += 1) {
            try {
                const response = await fetch(candidate, {
                    signal: AbortSignal.timeout(timeoutMs),
                });

                if (!response.ok || !response.body) {
                    failures.push(`${candidate} [attempt ${attempt}] -> HTTP ${response.status}`);
                } else {
                    return { url: candidate, response };
                }
            } catch (error) {
                failures.push(
                    `${candidate} [attempt ${attempt}] -> ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }

            if (attempt < DEFAULT_SOURCE_FETCH_RETRIES) {
                await sleep(Math.min(5000, attempt * 1000));
            }
        }
    }

    throw new Error(
        `Failed to download source object ${task.sourceBucket}/${task.objectPath}. Attempts: ${failures.join("; ")}`,
    );
}

function buildUploadHeaders(response: Response) {
    return {
        blobContentType: response.headers.get("content-type") || undefined,
        blobCacheControl: response.headers.get("cache-control") || undefined,
        blobContentDisposition: response.headers.get("content-disposition") || undefined,
        blobContentEncoding: response.headers.get("content-encoding") || undefined,
        blobContentLanguage: response.headers.get("content-language") || undefined,
    };
}

async function verifyStateRecord(
    containerClient: ContainerClient,
    task: ObjectTask,
    record: ObjectStateRecord,
) {
    const blockBlobClient = containerClient.getBlockBlobClient(task.destinationBlobName);
    const properties = await blockBlobClient.getProperties();

    if (properties.contentLength !== record.bytes) {
        throw new Error(
            `Azure blob size mismatch for ${task.destinationBlobName}. Expected ${record.bytes}, received ${properties.contentLength}.`,
        );
    }

    if (record.contentType && properties.contentType && properties.contentType !== record.contentType) {
        throw new Error(
            `Azure blob content-type mismatch for ${task.destinationBlobName}. Expected ${record.contentType}, received ${properties.contentType}.`,
        );
    }
}

async function copyObjectToAzure(
    task: ObjectTask,
    containerClient: ContainerClient,
    options: Options,
    state: MigrationState,
    index: number,
    total: number,
) {
    const existing = state.objects[task.key];
    if (existing) {
        await verifyStateRecord(containerClient, task, existing);
        console.log(
            `[${index}/${total}] Reused verified blob ${task.destinationBlobName} (${formatBytes(existing.bytes)})`,
        );
        return existing;
    }

    const { url, response } = await tryFetchSource(task, options.sourceRequestTimeoutMs);
    const blockBlobClient = containerClient.getBlockBlobClient(task.destinationBlobName);
    const uploadHeaders = buildUploadHeaders(response);
    const expectedLengthHeader = response.headers.get("content-length");
    const expectedLength =
        expectedLengthHeader !== null ? Number.parseInt(expectedLengthHeader, 10) : null;

    const countingStream = new CountingHashStream();
    const sourceStream = Readable.fromWeb(response.body as unknown as NodeReadableStream);

    await blockBlobClient.uploadStream(
        sourceStream.pipe(countingStream),
        options.uploadBufferSize,
        options.uploadConcurrency,
        {
            blobHTTPHeaders: uploadHeaders,
        },
    );

    const digest = countingStream.digestHex();
    const properties = await blockBlobClient.getProperties();

    if (expectedLength !== null && Number.isFinite(expectedLength) && countingStream.bytes !== expectedLength) {
        throw new Error(
            `Downloaded byte count mismatch for ${task.sourceBucket}/${task.objectPath}. Expected ${expectedLength}, received ${countingStream.bytes}.`,
        );
    }

    if (properties.contentLength !== countingStream.bytes) {
        throw new Error(
            `Uploaded byte count mismatch for ${task.destinationBlobName}. Azure reports ${properties.contentLength}, copied ${countingStream.bytes}.`,
        );
    }

    const record: ObjectStateRecord = {
        sourceBucket: task.sourceBucket,
        objectPath: task.objectPath,
        destinationBlobName: task.destinationBlobName,
        destinationUrl: task.destinationUrl,
        sourceUrl: url,
        bytes: countingStream.bytes,
        sha256: digest,
        contentType: properties.contentType || uploadHeaders.blobContentType || null,
        etag: properties.etag || null,
        copiedAt: new Date().toISOString(),
    };

    state.objects[task.key] = record;
    await persistState(options.stateFile, state);

    console.log(
        `[${index}/${total}] Copied ${task.sourceBucket}/${task.objectPath} -> ${task.destinationBlobName} (${formatBytes(record.bytes)})`,
    );

    return record;
}

async function verifyAllTasksHaveState(
    containerClient: ContainerClient,
    tasks: ObjectTask[],
    state: MigrationState,
) {
    for (const task of tasks) {
        const record = state.objects[task.key];
        if (!record) {
            throw new Error(
                `Missing verified state for ${task.sourceBucket}/${task.objectPath}. Re-run without --skip-copy.`,
            );
        }

        await verifyStateRecord(containerClient, task, record);
    }
}

async function runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number, total: number) => Promise<void>,
) {
    let nextIndex = 0;
    let aborted = false;

    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (!aborted) {
            const currentIndex = nextIndex;
            nextIndex += 1;

            if (currentIndex >= items.length) {
                return;
            }

            try {
                await worker(items[currentIndex], currentIndex + 1, items.length);
            } catch (error) {
                aborted = true;
                throw error;
            }
        }
    });

    await Promise.all(runners);
}

function buildUpdateGroups(references: UrlReference[]) {
    const grouped = new Map<string, BulkUpdateGroup>();

    for (const reference of references) {
        if (reference.currentUrl === reference.destinationUrl) {
            continue;
        }

        const key = `${reference.model}.${reference.field}`;
        const existing = grouped.get(key);
        const row: UpdateInstruction = {
            model: reference.model,
            field: reference.field,
            id: reference.id,
            currentUrl: reference.currentUrl,
            nextUrl: reference.destinationUrl,
        };

        if (!existing) {
            grouped.set(key, {
                model: reference.model,
                field: reference.field,
                rows: [row],
            });
            continue;
        }

        existing.rows.push(row);
    }

    return [...grouped.values()].sort((left, right) =>
        `${left.model}.${left.field}`.localeCompare(`${right.model}.${right.field}`),
    );
}

function chunk<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

async function executeBulkUrlUpdate(
    tx: prismaClient.Prisma.TransactionClient,
    group: BulkUpdateGroup,
    batchSize: number,
) {
    const tableName = Prisma.raw(TABLE_NAMES[group.model]);
    const columnName = Prisma.raw(COLUMN_NAMES[group.field]);
    const targetColumn = Prisma.raw(`target.${COLUMN_NAMES[group.field]}`);

    let updatedRows = 0;

    for (const batch of chunk(group.rows, batchSize)) {
        const typedValueRows = batch.map((row) => Prisma.sql`
            (
                CAST(${row.id} AS TEXT),
                CAST(${row.currentUrl} AS TEXT),
                CAST(${row.nextUrl} AS TEXT)
            )
        `);

        const result = await tx.$executeRaw(
            Prisma.sql`
                WITH data("id", "oldUrl", "newUrl") AS (
                    VALUES ${Prisma.join(typedValueRows)}
                )
                UPDATE ${tableName} AS target
                SET ${columnName} = data."newUrl"
                FROM data
                WHERE target."id" = data."id"
                  AND ${targetColumn} = data."oldUrl"
            `,
        );

        if (result !== batch.length) {
            throw new Error(
                `Expected to update ${batch.length} ${group.model}.${group.field} rows, but updated ${result}. The database changed during migration; no rows were committed.`,
            );
        }

        updatedRows += result;
    }

    return updatedRows;
}

async function rewriteDatabaseUrls(
    prisma: InstanceType<typeof PrismaClient>,
    groups: BulkUpdateGroup[],
    batchSize: number,
) {
    return prisma.$transaction(async (tx) => {
        let totalUpdatedRows = 0;

        for (const group of groups) {
            const updated = await executeBulkUrlUpdate(tx, group, batchSize);
            console.log(`Updated ${updated} ${group.model}.${group.field} row(s).`);
            totalUpdatedRows += updated;
        }

        return totalUpdatedRows;
    });
}

async function countRemainingExternalReferences(
    prisma: InstanceType<typeof PrismaClient>,
    destinationBaseUrl: string,
) {
    const [notes, papers, syllabiRows] = await Promise.all([
        prisma.note.findMany({
            select: {
                fileUrl: true,
                thumbNailUrl: true,
            },
        }),
        prisma.pastPaper.findMany({
            select: {
                fileUrl: true,
                thumbNailUrl: true,
            },
        }),
        prisma.syllabi.findMany({
            select: {
                fileUrl: true,
            },
        }),
    ]);

    const counts = {
        noteFileUrls: 0,
        noteThumbUrls: 0,
        paperFileUrls: 0,
        paperThumbUrls: 0,
        syllabiFileUrls: 0,
    };

    for (const note of notes) {
        if (
            note.fileUrl &&
            !isTargetAzureUrl(note.fileUrl, destinationBaseUrl) &&
            !shouldSkipSourceUrl(note.fileUrl)
        ) {
            counts.noteFileUrls += 1;
        }
        if (
            note.thumbNailUrl &&
            !isTargetAzureUrl(note.thumbNailUrl, destinationBaseUrl) &&
            !shouldSkipSourceUrl(note.thumbNailUrl)
        ) {
            counts.noteThumbUrls += 1;
        }
    }

    for (const paper of papers) {
        if (
            paper.fileUrl &&
            !isTargetAzureUrl(paper.fileUrl, destinationBaseUrl) &&
            !shouldSkipSourceUrl(paper.fileUrl)
        ) {
            counts.paperFileUrls += 1;
        }
        if (
            paper.thumbNailUrl &&
            !isTargetAzureUrl(paper.thumbNailUrl, destinationBaseUrl) &&
            !shouldSkipSourceUrl(paper.thumbNailUrl)
        ) {
            counts.paperThumbUrls += 1;
        }
    }

    for (const syllabiRow of syllabiRows) {
        if (
            syllabiRow.fileUrl &&
            !isTargetAzureUrl(syllabiRow.fileUrl, destinationBaseUrl) &&
            !shouldSkipSourceUrl(syllabiRow.fileUrl)
        ) {
            counts.syllabiFileUrls += 1;
        }
    }

    return counts;
}

async function countSkippedSourceReferences(prisma: InstanceType<typeof PrismaClient>) {
    const [notes, papers, syllabiRows] = await Promise.all([
        prisma.note.findMany({
            select: {
                fileUrl: true,
                thumbNailUrl: true,
            },
        }),
        prisma.pastPaper.findMany({
            select: {
                fileUrl: true,
                thumbNailUrl: true,
            },
        }),
        prisma.syllabi.findMany({
            select: {
                fileUrl: true,
            },
        }),
    ]);

    const counts = {
        noteFileUrls: 0,
        noteThumbUrls: 0,
        paperFileUrls: 0,
        paperThumbUrls: 0,
        syllabiFileUrls: 0,
    };

    for (const note of notes) {
        if (note.fileUrl && shouldSkipSourceUrl(note.fileUrl)) {
            counts.noteFileUrls += 1;
        }
        if (note.thumbNailUrl && shouldSkipSourceUrl(note.thumbNailUrl)) {
            counts.noteThumbUrls += 1;
        }
    }

    for (const paper of papers) {
        if (paper.fileUrl && shouldSkipSourceUrl(paper.fileUrl)) {
            counts.paperFileUrls += 1;
        }
        if (paper.thumbNailUrl && shouldSkipSourceUrl(paper.thumbNailUrl)) {
            counts.paperThumbUrls += 1;
        }
    }

    for (const syllabiRow of syllabiRows) {
        if (syllabiRow.fileUrl && shouldSkipSourceUrl(syllabiRow.fileUrl)) {
            counts.syllabiFileUrls += 1;
        }
    }

    return counts;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));

    validatePublicBaseUrl(options.publicBaseUrl);

    const containerClient = options.connectionString
        ? BlobServiceClient.fromConnectionString(options.connectionString).getContainerClient(
              options.containerName,
          )
        : null;

    const publicBaseUrl = normalizeBaseUrl(options.publicBaseUrl || containerClient!.url);
    const prisma = buildPrismaClient(options.databaseUrl);

    try {
        const bootstrap = await Promise.all([
            prisma.note.findMany({
                select: {
                    id: true,
                    fileUrl: true,
                    thumbNailUrl: true,
                },
            }),
            prisma.pastPaper.findMany({
                select: {
                    id: true,
                    fileUrl: true,
                    thumbNailUrl: true,
                },
            }),
            prisma.syllabi.findMany({
                select: {
                    id: true,
                    fileUrl: true,
                },
            }),
        ]).then(([notes, papers, syllabiRows]) => ({ notes, papers, syllabiRows }));

        const persistedPathPrefixMode =
            options.pathPrefixMode === "auto"
                ? await loadPersistedPathPrefixMode(
                      options.stateFile,
                      options.containerName,
                      publicBaseUrl,
                  )
                : null;

        let pathPrefixMode = persistedPathPrefixMode;
        if (!pathPrefixMode) {
            const provisionalSourceBuckets = new Set<string>();
            for (const row of bootstrap.notes) {
                for (const url of [row.fileUrl, row.thumbNailUrl]) {
                    if (!url) continue;
                    if (isTargetAzureUrl(url, publicBaseUrl)) continue;
                    if (shouldSkipSourceUrl(url)) continue;
                    try {
                        provisionalSourceBuckets.add(parseSourceUrl(url).sourceBucket);
                    } catch {
                        // handled below
                    }
                }
            }
            for (const row of bootstrap.papers) {
                for (const url of [row.fileUrl, row.thumbNailUrl]) {
                    if (!url) continue;
                    if (isTargetAzureUrl(url, publicBaseUrl)) continue;
                    if (shouldSkipSourceUrl(url)) continue;
                    try {
                        provisionalSourceBuckets.add(parseSourceUrl(url).sourceBucket);
                    } catch {
                        // handled below
                    }
                }
            }
            for (const row of bootstrap.syllabiRows) {
                const url = row.fileUrl;
                if (!url || isTargetAzureUrl(url, publicBaseUrl) || shouldSkipSourceUrl(url)) continue;
                try {
                    provisionalSourceBuckets.add(parseSourceUrl(url).sourceBucket);
                } catch {
                    // handled below
                }
            }

            pathPrefixMode = resolvePathPrefixMode(
                options.pathPrefixMode,
                [...provisionalSourceBuckets].sort(),
            );
        }

        const { references, alreadyTarget, unsupported, skipped, sourceBuckets, totalRows } =
            await loadReferences(prisma, publicBaseUrl, pathPrefixMode);

        if (unsupported.length > 0) {
            const samples = unsupported
                .slice(0, 10)
                .map((entry) => `${entry.model}.${entry.field} ${entry.id} -> ${entry.url}`)
                .join("\n");
            throw new Error(
                `Found ${unsupported.length} unsupported URL(s) that are neither publicly fetchable HTTP(S) sources nor already under the Azure target base URL. Sample:\n${samples}`,
            );
        }

        if (references.length === 0) {
            console.log("No Note/PastPaper/syllabi URLs remain to migrate into Azure.");
            if (Object.values(alreadyTarget).some((count) => count > 0)) {
                console.log("Rows already pointing at Azure:");
                console.table(alreadyTarget);
            }
            return;
        }

        ensureNoCrossBucketCollisions(pathPrefixMode, references);

        const objectTasks = buildObjectTasks(references, publicBaseUrl);
        const summary = summarizeReferences(references);
        const skippedSummary = summarizeSkippedReferences(skipped);

        const sampleMappings = references.slice(0, 5).map((reference) => ({
            source: `${reference.sourceBucket}/${reference.objectPath}`,
            target: reference.destinationBlobName,
            model: `${reference.model}.${reference.field}`,
        }));

        console.log("Migration plan:");
        console.table({
            databaseRows: totalRows.notes + totalRows.papers + totalRows.syllabi,
            notes: totalRows.notes,
            pastPapers: totalRows.papers,
            syllabi: totalRows.syllabi,
            remainingExternalReferences: references.length,
            uniqueObjects: objectTasks.length,
            sourceRoots: sourceBuckets.length,
            skippedReferences: skipped.length,
            pathPrefixMode,
            destinationContainer: options.containerName,
            publicBaseUrl,
            stateFile: options.stateFile,
            dryRun: options.dryRun,
            skipCopy: options.skipCopy,
            skipDbUpdate: options.skipDbUpdate,
        });

        console.log("Rows already pointing at Azure:");
        console.table(alreadyTarget);

        console.log("Reference counts by source root:");
        console.table(summary.bucketCounts);

        console.log("Reference counts by model.field:");
        console.table(summary.modelFieldCounts);

        if (skipped.length > 0) {
            console.log("Configured source hosts that will be skipped and left unchanged:");
            console.table(skippedSummary.hostCounts);

            console.log("Skipped reference counts by model.field:");
            console.table(skippedSummary.modelFieldCounts);

            const skippedSamples = skipped
                .slice(0, 5)
                .map((reference) => ({
                    source: reference.url,
                    model: `${reference.model}.${reference.field}`,
                }));
            console.log("Sample skipped references:");
            console.table(skippedSamples);
        }

        if (summary.strippedSigningQueryRefs > 0) {
            console.log("GCS signing query parameters will be stripped during rewrite:");
            console.table({
                affectedReferences: summary.strippedSigningQueryRefs,
                ...summary.strippedKeys,
            });
        }

        console.log("Sample source -> target mappings:");
        console.table(sampleMappings);

        if (options.dryRun) {
            console.log("Dry run only. No Azure or database changes were applied.");
            return;
        }

        await ensureContainer(containerClient!, options);

        const state = await loadState(
            options.stateFile,
            options.containerName,
            publicBaseUrl,
            pathPrefixMode,
        );

        if (!options.skipCopy) {
            await runWithConcurrency(objectTasks, options.copyConcurrency, async (task, index, total) => {
                await copyObjectToAzure(task, containerClient!, options, state, index, total);
            });
        } else {
            console.log("Skipping copy step. Requiring previously verified state for every blob.");
        }

        await verifyAllTasksHaveState(containerClient!, objectTasks, state);
        console.log(`Verified ${objectTasks.length} Azure blob(s) before database cutover.`);

        if (!options.skipDbUpdate) {
            const updateGroups = buildUpdateGroups(references);
            const rowsToUpdate = updateGroups.reduce((count, group) => count + group.rows.length, 0);

            console.log(`Rewriting ${rowsToUpdate} database URL reference(s) inside a transaction...`);
            const updatedRows = await rewriteDatabaseUrls(prisma, updateGroups, options.dbBatchSize);

            state.dbRewrite = {
                completedAt: new Date().toISOString(),
                updatedRows,
            };
            await persistState(options.stateFile, state);

            console.log(`Database rewrite committed. Updated ${updatedRows} row(s).`);
        } else {
            console.log("Skipping database rewrite step.");
        }

        const remainingExternal = await countRemainingExternalReferences(prisma, publicBaseUrl);
        console.log("Remaining non-Azure URL references in Note/PastPaper/syllabi:");
        console.table(remainingExternal);

        const skippedRemaining = await countSkippedSourceReferences(prisma);
        console.log("Skipped configured-host references left unchanged:");
        console.table(skippedRemaining);

        console.log("Azure migration complete.");
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
