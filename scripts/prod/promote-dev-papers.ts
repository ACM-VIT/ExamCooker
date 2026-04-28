import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { createScriptDb, queryRows } from "../lib/db";
import { loadScriptEnv } from "../lib/env";
import {
  ensureTagNames,
  getPaperTagNames,
  loadCourseRows,
  loadPastPaperRows,
  loadTagNameRows,
  setPastPaperTags,
  upsertCourseByCode,
} from "../lib/pastPapers";

loadScriptEnv();

type CourseRow = {
  id: string;
  code: string;
  title: string;
  aliases: string[];
};

type PaperRow = {
  id: string;
  title: string;
  fileUrl: string;
  thumbNailUrl: string | null;
  isClear: boolean;
  examType: string | null;
  slot: string | null;
  year: number | null;
  semester: string;
  campus: string;
  hasAnswerKey: boolean;
  questionPaperId: string | null;
  createdAt: Date;
  course: CourseRow | null;
  tags: string[];
};

type ResolvedPaperIdentity = {
  courseCode: string | null;
  examType: string | null;
  slot: string | null;
  year: number | null;
  hasAnswerKey: boolean;
};

type VerificationLedger = {
  papers: Record<string, { verified: boolean }>;
};

type PromotionAction =
  | "create"
  | "update"
  | "skip"
  | "skip_existing"
  | "skip_unverified"
  | "blocked_missing_metadata"
  | "blocked_target_duplicate";

type PromotionRecord = {
  sourcePaperId: string;
  targetPaperId: string | null;
  action: PromotionAction;
  reason: string;
  courseCode: string | null;
  title: string;
  hasAnswerKey: boolean;
  key: string | null;
};

type PromotionManifest = {
  generatedAt: string;
  sourceDatabaseUrlHost: string;
  targetDatabaseUrlHost: string;
  filters: {
    dryRun: boolean;
    courseCodes: string[];
    limit: number | null;
    requireVerified: boolean;
    createOnly: boolean;
    failOnTargetDuplicates: boolean;
    createdAfter: string | null;
  };
  summary: {
    sourcePapers: number;
    created: number;
    updated: number;
    skipped: number;
    skippedExisting: number;
    skippedUnverified: number;
    blocked: number;
    blockedMissingMetadata: number;
    blockedTargetDuplicates: number;
    targetDuplicateKeys: number;
    linkedAnswerKeys: number;
  };
  touchedPapers: Array<{
    sourcePaperId: string;
    targetPaperId: string;
    action: "create" | "update";
    courseCode: string | null;
    title: string;
    fileUrl: string;
    thumbNailUrl: string | null;
  }>;
  records: PromotionRecord[];
};

type Options = {
  sourceDatabaseUrl: string;
  targetDatabaseUrl: string;
  verifiedLedgerFile: string;
  importUserEmail: string;
  importUserName: string;
  outputManifestFile: string | null;
  outputMarkdownFile: string | null;
  dryRun: boolean;
  requireVerified: boolean;
  createOnly: boolean;
  failOnTargetDuplicates: boolean;
  failOnBlocked: boolean;
  createdAfter: Date | null;
  courseCodes: string[];
  limit: number | null;
};

const REPORT_DIR = path.resolve(process.cwd(), "scripts/reports");
const COURSE_TAG_REGEX = /^(.*?)\s*\[([A-Z]{2,7}\s?\d{2,5}[A-Z]{0,3})\]\s*$/i;
const SLOT_REGEX = /\b([A-G][1-2])\b/i;
const YEAR_RANGE_REGEX = /\b((?:20)?\d{2})\s*-\s*((?:20)?\d{2})\b/;
const YEAR_REGEX = /\b(20\d{2})\b/;
const COURSE_CODE_GLOBAL_REGEX = /([A-Z]{2,7}\s?\d{2,5}[A-Z]{0,3})/gi;
const ANSWER_KEY_REGEX =
  /\b(answer\s*key|with\s*answer\s*key|answers\b|solution\s*key|solutions\b)\b/i;

function usage() {
  console.log(
    [
      "Usage:",
      "  pnpm prod:promote_papers [options]",
      "",
      "Environment:",
      "  SOURCE_DATABASE_URL or DEV_DATABASE      Source dev database URL",
      "  TARGET_DATABASE_URL or PROD_DATABASE_URL or PROD_DB Target prod database URL",
      "",
      "Options:",
      "  --dry-run",
      "  --allow-unverified",
      "  --allow-updates",
      "  --allow-target-duplicates",
      "  --allow-blocked",
      "  --created-after=2026-04-20T00:00:00.000Z",
      "  --course-codes=BCSE202L,BMAT101L",
      "  --limit=50",
      "  --ledger=/abs/path/to/verification/ledger.json",
      "  --source-db=<url>",
      "  --target-db=<url>",
      "  --import-user-email=<email>",
      "  --import-user-name=<name>",
      "  --output-manifest=<path>",
      "  --output-markdown=<path>",
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
    importUserEmail: process.env.PROD_IMPORT_USER_EMAIL?.trim() || "prod-import@examcooker.local",
    importUserName: process.env.PROD_IMPORT_USER_NAME?.trim() || "ExamCooker Production Import",
    outputManifestFile: null,
    outputMarkdownFile: null,
    dryRun: false,
    requireVerified: true,
    createOnly: true,
    failOnTargetDuplicates: true,
    failOnBlocked: true,
    createdAfter: null,
    courseCodes: [],
    limit: null,
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

    if (arg === "--allow-unverified") {
      options.requireVerified = false;
      continue;
    }

    if (arg === "--allow-updates") {
      options.createOnly = false;
      continue;
    }

    if (arg === "--allow-target-duplicates") {
      options.failOnTargetDuplicates = false;
      continue;
    }

    if (arg === "--allow-blocked") {
      options.failOnBlocked = false;
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
      case "--ledger":
        options.verifiedLedgerFile = path.resolve(process.cwd(), value);
        break;
      case "--source-db":
        options.sourceDatabaseUrl = value;
        break;
      case "--target-db":
        options.targetDatabaseUrl = value;
        break;
      case "--course-codes":
        options.courseCodes = value
          .split(",")
          .map((entry) => entry.trim().toUpperCase())
          .filter(Boolean);
        break;
      case "--created-after": {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          throw new Error(`Invalid --created-after timestamp: ${value}`);
        }
        options.createdAfter = parsed;
        break;
      }
      case "--limit":
        options.limit = parsePositiveInt(flag, value);
        break;
      case "--import-user-email":
        options.importUserEmail = value;
        break;
      case "--import-user-name":
        options.importUserName = value;
        break;
      case "--output-manifest":
        options.outputManifestFile = path.resolve(process.cwd(), value);
        break;
      case "--output-markdown":
        options.outputMarkdownFile = path.resolve(process.cwd(), value);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.sourceDatabaseUrl) {
    throw new Error("Missing source database URL. Set SOURCE_DATABASE_URL or DEV_DATABASE.");
  }

  if (!options.targetDatabaseUrl) {
    throw new Error("Missing target database URL. Set TARGET_DATABASE_URL or PROD_DATABASE_URL.");
  }

  if (options.sourceDatabaseUrl === options.targetDatabaseUrl) {
    throw new Error("Source and target database URLs are identical. Refusing to run.");
  }

  return options;
}

function createClient(connectionString: string) {
  return createScriptDb(connectionString);
}

function normalizeCode(code: string | null | undefined) {
  return String(code || "").replace(/\s+/g, "").toUpperCase() || null;
}

function normalizeSlot(slot: string | null | undefined) {
  return String(slot || "").trim().toUpperCase() || null;
}

function normalizeYear(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 4) return digits;
  if (digits.length === 2) return `20${digits}`;
  return null;
}

function extractCourseFromTag(tagName: string) {
  const trimmed = String(tagName || "").trim();
  const match = trimmed.match(COURSE_TAG_REGEX);
  if (!match || !match[2]) return null;
  return { code: normalizeCode(match[2]), title: (match[1] || "").trim() };
}

function extractCourseCodeFromTitle(title: string | null | undefined) {
  let lastMatch: string | null = null;
  const upper = String(title || "").toUpperCase();
  let match;
  while ((match = COURSE_CODE_GLOBAL_REGEX.exec(upper)) !== null) {
    lastMatch = normalizeCode(match[1]);
  }
  COURSE_CODE_GLOBAL_REGEX.lastIndex = 0;
  return lastMatch;
}

function extractExamTypeFromTitle(title: string | null | undefined) {
  const value = String(title || "");
  if (/\bmodel\s+cat[-\s]?1\b/i.test(value)) return "MODEL_CAT_1";
  if (/\bmodel\s+cat[-\s]?2\b/i.test(value)) return "MODEL_CAT_2";
  if (/\bmodel\s+fat\b/i.test(value)) return "MODEL_FAT";
  if (/\bcat[-\s]?1\b/i.test(value)) return "CAT_1";
  if (/\bcat[-\s]?2\b/i.test(value)) return "CAT_2";
  if (/\bfat(?:\s*2)?\b/i.test(value)) return "FAT";
  if (/\bmid(?:term)?\b/i.test(value)) return "MID";
  if (/\bquiz\b/i.test(value)) return "QUIZ";
  if (/\bcia\b/i.test(value)) return "CIA";
  return null;
}

function extractSlotFromPaper(paper: PaperRow) {
  const titleSlot = String(paper.title || "").match(SLOT_REGEX)?.[1];
  if (titleSlot) return normalizeSlot(titleSlot);
  const slotTag = paper.tags.find((tag) => SLOT_REGEX.test(tag) || /^[A-G][1-2]$/i.test(tag));
  return slotTag ? normalizeSlot(slotTag.match(SLOT_REGEX)?.[1] ?? slotTag) : null;
}

function extractYearFromTitle(title: string | null | undefined) {
  const value = String(title || "");
  const range = value.match(YEAR_RANGE_REGEX);
  if (range) {
    const normalized = normalizeYear(range[1]);
    return normalized ? Number(normalized) : null;
  }
  const single = value.match(YEAR_REGEX);
  if (single) {
    const normalized = normalizeYear(single[1]);
    return normalized ? Number(normalized) : null;
  }
  return null;
}

function inferHasAnswerKeyFromTitle(title: string | null | undefined) {
  return ANSWER_KEY_REGEX.test(String(title || ""));
}

function resolvePaperIdentity(paper: PaperRow): ResolvedPaperIdentity {
  const courseFromTags = paper.tags
    .map((tag) => extractCourseFromTag(tag))
    .find((entry) => entry?.code)?.code ?? null;
  return {
    courseCode:
      extractCourseCodeFromTitle(paper.title) ??
      normalizeCode(paper.course?.code) ??
      courseFromTags,
    examType: paper.examType ?? extractExamTypeFromTitle(paper.title),
    slot: normalizeSlot(paper.slot) ?? extractSlotFromPaper(paper),
    year: paper.year ?? extractYearFromTitle(paper.title),
    hasAnswerKey: paper.hasAnswerKey || inferHasAnswerKeyFromTitle(paper.title),
  };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sortedStrings(values: string[]) {
  return uniqueStrings(values).sort((left, right) => left.localeCompare(right));
}

function canonicalVariantKey(paper: PaperRow) {
  const identity = resolvePaperIdentity(paper);
  if (!identity.courseCode || !identity.examType || !identity.slot || !identity.year) {
    return null;
  }

  return [
    identity.courseCode,
    identity.examType,
    identity.slot,
    String(identity.year),
    identity.hasAnswerKey ? "ANSWER_KEY" : "QUESTION_PAPER",
  ].join("::");
}

function markdownEscape(value: string) {
  return value.replace(/\|/g, "\\|");
}

function shouldPreserveTargetAssetUrl(targetUrl: string, sourceUrl: string) {
  try {
    const target = new URL(targetUrl);
    const source = new URL(sourceUrl);
    return target.host !== source.host;
  } catch {
    return targetUrl !== sourceUrl;
  }
}

function buildPaperTagNames(paper: PaperRow) {
  return sortedStrings(paper.tags);
}

async function readLedger(pathname: string) {
  const raw = await readFile(pathname, "utf8");
  return JSON.parse(raw) as VerificationLedger;
}

async function ensureReportDir() {
  await mkdir(REPORT_DIR, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function buildMarkdown(manifest: PromotionManifest) {
  const lines = [
    "# Prod Paper Promotion Report",
    "",
    `Generated: ${manifest.generatedAt}`,
    `Dry run: ${manifest.filters.dryRun ? "yes" : "no"}`,
    `Source DB host: ${manifest.sourceDatabaseUrlHost}`,
    `Target DB host: ${manifest.targetDatabaseUrlHost}`,
    `Require verified: ${manifest.filters.requireVerified ? "yes" : "no"}`,
    `Create only: ${manifest.filters.createOnly ? "yes" : "no"}`,
    `Fail on target duplicates: ${manifest.filters.failOnTargetDuplicates ? "yes" : "no"}`,
    `Created after: ${manifest.filters.createdAfter ?? "none"}`,
    "",
    "## Summary",
    "",
    `- Source papers considered: ${manifest.summary.sourcePapers}`,
    `- Created: ${manifest.summary.created}`,
    `- Updated: ${manifest.summary.updated}`,
    `- Skipped: ${manifest.summary.skipped}`,
    `- Skipped existing: ${manifest.summary.skippedExisting}`,
    `- Skipped unverified: ${manifest.summary.skippedUnverified}`,
    `- Blocked: ${manifest.summary.blocked}`,
    `- Blocked (missing metadata): ${manifest.summary.blockedMissingMetadata}`,
    `- Blocked (target duplicates): ${manifest.summary.blockedTargetDuplicates}`,
    `- Target duplicate keys: ${manifest.summary.targetDuplicateKeys}`,
    `- Linked answer keys: ${manifest.summary.linkedAnswerKeys}`,
    "",
    "## Actions",
    "",
    "| Action | Course | Variant | Title | Reason |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const record of manifest.records.slice(0, 250)) {
    lines.push(
      `| ${record.action} | ${record.courseCode ?? "-"} | ${record.hasAnswerKey ? "AK" : "QP"} | ${markdownEscape(record.title)} | ${markdownEscape(record.reason)} |`,
    );
  }

  if (manifest.records.length > 250) {
    lines.push("", `_Showing first 250 of ${manifest.records.length} records._`);
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const source = createClient(options.sourceDatabaseUrl);
  const target = createClient(options.targetDatabaseUrl);

  try {
    const ledger = options.requireVerified ? await readLedger(options.verifiedLedgerFile) : null;
    const filterCourseCodes = new Set(options.courseCodes.map((code) => code.toUpperCase()));

    const [sourcePapers, targetPapers, targetCourses, targetTags] = await Promise.all([
      loadPastPaperRows(source.pool, {
        requireStructured: true,
        courseCodes: filterCourseCodes.size > 0 ? [...filterCourseCodes] : undefined,
        createdAfter: options.createdAfter,
        limit: options.limit,
      }),
      loadPastPaperRows(target.pool),
      loadCourseRows(target.pool),
      loadTagNameRows(target.pool),
    ]);

    const mappedSourcePapers: PaperRow[] = sourcePapers.map((paper) => ({
      ...paper,
      tags: getPaperTagNames(paper),
    }));
    const mappedTargetPapers: PaperRow[] = targetPapers.map((paper) => ({
      ...paper,
      tags: getPaperTagNames(paper),
    }));

    const targetPapersByKey = new Map<string, PaperRow[]>();
    for (const paper of mappedTargetPapers) {
      const key = canonicalVariantKey(paper);
      if (!key) continue;
      const existing = targetPapersByKey.get(key);
      if (existing) existing.push(paper);
      else targetPapersByKey.set(key, [paper]);
    }

    const targetDuplicateKeys = new Set(
      [...targetPapersByKey.entries()]
        .filter(([, papers]) => papers.length > 1)
        .map(([key]) => key),
    );

    const targetCourseByCode = new Map(
      targetCourses.map((course) => [normalizeCode(course.code) ?? course.code, course]),
    );
    const targetTagNames = new Set(targetTags.map((tag) => tag.name));
    const sourcePaperById = new Map(mappedSourcePapers.map((paper) => [paper.id, paper]));
    const sourceToTargetIds = new Map<string, string>();
    const touchedPapers: PromotionManifest["touchedPapers"] = [];
    const records: PromotionRecord[] = [];

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let skippedExisting = 0;
    let skippedUnverified = 0;
    let blocked = 0;
    let blockedMissingMetadata = 0;
    let blockedTargetDuplicates = 0;

    const importUser = options.dryRun
      ? { id: "dry-run-import-user" }
      : await queryRows<{ id: string }>(
          target.pool,
          `
            INSERT INTO "User" (id, email, name, role, "createdAt", "updatedAt")
            VALUES (gen_random_uuid()::text, $1, $2, 'MODERATOR', NOW(), NOW())
            ON CONFLICT (email)
            DO UPDATE SET
              name = EXCLUDED.name,
              role = EXCLUDED.role,
              "updatedAt" = NOW()
            RETURNING id
          `,
          [options.importUserEmail, options.importUserName],
        ).then((rows) => {
          const [user] = rows;
          if (!user) {
            throw new Error(`Failed to upsert import user ${options.importUserEmail}`);
          }
          return user;
        });

    for (const sourcePaper of mappedSourcePapers) {
      const key = canonicalVariantKey(sourcePaper);
      const courseCode = normalizeCode(sourcePaper.course?.code);

      if (!key || !courseCode || !sourcePaper.course) {
        blocked += 1;
        blockedMissingMetadata += 1;
        records.push({
          sourcePaperId: sourcePaper.id,
          targetPaperId: null,
          action: "blocked_missing_metadata",
          reason: "Source paper is missing structured metadata required for promotion.",
          courseCode,
          title: sourcePaper.title,
          hasAnswerKey: sourcePaper.hasAnswerKey,
          key,
        });
        continue;
      }

      if (options.requireVerified && ledger?.papers[sourcePaper.id]?.verified !== true) {
        skipped += 1;
        skippedUnverified += 1;
        records.push({
          sourcePaperId: sourcePaper.id,
          targetPaperId: null,
          action: "skip_unverified",
          reason: "Source paper is not marked verified in the verifier ledger, so it is out of scope for this release.",
          courseCode,
          title: sourcePaper.title,
          hasAnswerKey: sourcePaper.hasAnswerKey,
          key,
        });
        continue;
      }

      const existingTargetPapers = targetPapersByKey.get(key) ?? [];
      if (existingTargetPapers.length > 1 && options.failOnTargetDuplicates) {
        blocked += 1;
        blockedTargetDuplicates += 1;
        records.push({
          sourcePaperId: sourcePaper.id,
          targetPaperId: null,
          action: "blocked_target_duplicate",
          reason: `Target database has ${existingTargetPapers.length} papers with the same canonical key.`,
          courseCode,
          title: sourcePaper.title,
          hasAnswerKey: sourcePaper.hasAnswerKey,
          key,
        });
        continue;
      }

      const existing = existingTargetPapers[0] ?? null;
      if (existing && options.createOnly) {
        sourceToTargetIds.set(sourcePaper.id, existing.id);
        skipped += 1;
        skippedExisting += 1;
        records.push({
          sourcePaperId: sourcePaper.id,
          targetPaperId: existing.id,
          action: "skip_existing",
          reason: "A matching prod paper already exists and create-only mode will not overwrite it.",
          courseCode,
          title: sourcePaper.title,
          hasAnswerKey: sourcePaper.hasAnswerKey,
          key,
        });
        continue;
      }

      let targetCourse = targetCourseByCode.get(courseCode) ?? null;
      const mergedAliases = sortedStrings([
        ...(targetCourse?.aliases ?? []),
        ...(sourcePaper.course.aliases ?? []),
      ]);

      if (!options.dryRun) {
        targetCourse = await upsertCourseByCode(target.pool, {
          code: courseCode,
          title: sourcePaper.course.title,
          aliases: mergedAliases,
        });
        targetCourseByCode.set(courseCode, targetCourse);
      } else if (!targetCourse) {
        targetCourse = {
          id: `dry-run-course-${courseCode}`,
          code: courseCode,
          title: sourcePaper.course.title,
          aliases: mergedAliases,
        };
        targetCourseByCode.set(courseCode, targetCourse);
      }

      const tagNames = buildPaperTagNames(sourcePaper);
      if (!options.dryRun) {
        const missingTagNames = tagNames.filter((tagName) => !targetTagNames.has(tagName));
        if (missingTagNames.length > 0) {
          await ensureTagNames(target.pool, missingTagNames);
          for (const tagName of missingTagNames) {
            targetTagNames.add(tagName);
          }
        }
      }
      if (!existing) {
        if (!options.dryRun) {
          const [createdPaper] = await queryRows<{ id: string }>(
            target.pool,
            `
              INSERT INTO "PastPaper" (
                id,
                title,
                "fileUrl",
                "thumbNailUrl",
                "authorId",
                "isClear",
                "createdAt",
                "updatedAt",
                "courseId",
                "examType",
                slot,
                year,
                semester,
                campus,
                "hasAnswerKey"
              )
              VALUES (
                gen_random_uuid()::text,
                $1,
                $2,
                $3,
                $4,
                $5,
                NOW(),
                NOW(),
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12
              )
              RETURNING id
            `,
            [
              sourcePaper.title,
              sourcePaper.fileUrl,
              sourcePaper.thumbNailUrl,
              importUser.id,
              sourcePaper.isClear,
              targetCourse?.id ?? null,
              sourcePaper.examType,
              sourcePaper.slot,
              sourcePaper.year,
              sourcePaper.semester,
              sourcePaper.campus,
              sourcePaper.hasAnswerKey,
            ],
          );
          if (!createdPaper) {
            throw new Error(`Failed to create target paper for source ${sourcePaper.id}`);
          }
          await setPastPaperTags(target.pool, createdPaper.id, tagNames);
          sourceToTargetIds.set(sourcePaper.id, createdPaper.id);
          targetPapersByKey.set(key, [{
            ...sourcePaper,
            id: createdPaper.id,
            course: targetCourse,
            tags: tagNames,
          }]);
          touchedPapers.push({
            sourcePaperId: sourcePaper.id,
            targetPaperId: createdPaper.id,
            action: "create",
            courseCode,
            title: sourcePaper.title,
            fileUrl: sourcePaper.fileUrl,
            thumbNailUrl: sourcePaper.thumbNailUrl,
          });
        } else {
          sourceToTargetIds.set(sourcePaper.id, `dry-run-paper-${sourcePaper.id}`);
        }

        created += 1;
        records.push({
          sourcePaperId: sourcePaper.id,
          targetPaperId: sourceToTargetIds.get(sourcePaper.id) ?? null,
          action: "create",
          reason: "No matching prod paper exists for this canonical key and variant.",
          courseCode,
          title: sourcePaper.title,
          hasAnswerKey: sourcePaper.hasAnswerKey,
          key,
        });
        continue;
      }

      sourceToTargetIds.set(sourcePaper.id, existing.id);

      const preserveFileUrl = shouldPreserveTargetAssetUrl(existing.fileUrl, sourcePaper.fileUrl);
      const preserveThumbnailUrl =
        existing.thumbNailUrl &&
        sourcePaper.thumbNailUrl &&
        shouldPreserveTargetAssetUrl(existing.thumbNailUrl, sourcePaper.thumbNailUrl);

      const nextFileUrl = preserveFileUrl ? existing.fileUrl : sourcePaper.fileUrl;
      const nextThumbNailUrl =
        preserveThumbnailUrl || !sourcePaper.thumbNailUrl
          ? existing.thumbNailUrl
          : sourcePaper.thumbNailUrl;

      const tagsChanged =
        JSON.stringify(sortedStrings(existing.tags)) !== JSON.stringify(sortedStrings(tagNames));
      const titleChanged = existing.title !== sourcePaper.title;
      const metadataChanged =
        normalizeCode(existing.course?.code) !== courseCode ||
        existing.course?.title !== sourcePaper.course.title ||
        existing.examType !== sourcePaper.examType ||
        normalizeSlot(existing.slot) !== normalizeSlot(sourcePaper.slot) ||
        existing.year !== sourcePaper.year ||
        existing.semester !== sourcePaper.semester ||
        existing.campus !== sourcePaper.campus ||
        resolvePaperIdentity(existing).hasAnswerKey !== sourcePaper.hasAnswerKey ||
        existing.isClear !== sourcePaper.isClear;
      const assetChanged =
        existing.fileUrl !== nextFileUrl || (existing.thumbNailUrl ?? null) !== (nextThumbNailUrl ?? null);

      if (!titleChanged && !metadataChanged && !tagsChanged && !assetChanged) {
        skipped += 1;
        records.push({
          sourcePaperId: sourcePaper.id,
          targetPaperId: existing.id,
          action: "skip",
          reason: "Prod row already matches the verified source paper.",
          courseCode,
          title: sourcePaper.title,
          hasAnswerKey: sourcePaper.hasAnswerKey,
          key,
        });
        continue;
      }

      if (!options.dryRun) {
        await target.pool.query(
          `
            UPDATE "PastPaper"
            SET title = $2,
                "isClear" = $3,
                "courseId" = $4,
                "examType" = $5,
                slot = $6,
                year = $7,
                semester = $8,
                campus = $9,
                "hasAnswerKey" = $10,
                "fileUrl" = $11,
                "thumbNailUrl" = $12,
                "updatedAt" = NOW()
            WHERE id = $1
          `,
          [
            existing.id,
            sourcePaper.title,
            sourcePaper.isClear,
            targetCourse?.id ?? null,
            sourcePaper.examType,
            sourcePaper.slot,
            sourcePaper.year,
            sourcePaper.semester,
            sourcePaper.campus,
            sourcePaper.hasAnswerKey,
            nextFileUrl,
            nextThumbNailUrl,
          ],
        );
        await setPastPaperTags(target.pool, existing.id, tagNames);
        touchedPapers.push({
          sourcePaperId: sourcePaper.id,
          targetPaperId: existing.id,
          action: "update",
          courseCode,
          title: sourcePaper.title,
          fileUrl: nextFileUrl,
          thumbNailUrl: nextThumbNailUrl,
        });
      }

      updated += 1;
      records.push({
        sourcePaperId: sourcePaper.id,
        targetPaperId: existing.id,
        action: "update",
        reason: "Prod row exists, but metadata, tags, or releasable asset URLs differ.",
        courseCode,
        title: sourcePaper.title,
        hasAnswerKey: sourcePaper.hasAnswerKey,
        key,
      });
    }

    let linkedAnswerKeys = 0;
    for (const sourcePaper of mappedSourcePapers) {
      if (!sourcePaper.hasAnswerKey || !sourcePaper.questionPaperId) continue;
      const targetAnswerKeyId = sourceToTargetIds.get(sourcePaper.id);
      if (!targetAnswerKeyId) continue;

      const sourceQuestionPaper = sourcePaperById.get(sourcePaper.questionPaperId);
      if (!sourceQuestionPaper) continue;

      const targetQuestionPaperId =
        sourceToTargetIds.get(sourceQuestionPaper.id) ??
        (() => {
          const questionKey = canonicalVariantKey(sourceQuestionPaper);
          if (!questionKey) return null;
          const matchingPapers = targetPapersByKey.get(questionKey) ?? [];
          return matchingPapers.length === 1 ? matchingPapers[0]?.id ?? null : null;
        })();

      if (!targetQuestionPaperId) continue;
      if (options.dryRun) {
        linkedAnswerKeys += 1;
        continue;
      }

      const [currentTargetAnswerKey] = await queryRows<{ questionPaperId: string | null }>(
        target.pool,
        'SELECT "questionPaperId" FROM "PastPaper" WHERE id = $1',
        [targetAnswerKeyId],
      );
      if (currentTargetAnswerKey?.questionPaperId === targetQuestionPaperId) continue;

      await target.pool.query(
        'UPDATE "PastPaper" SET "questionPaperId" = $2, "updatedAt" = NOW() WHERE id = $1',
        [targetAnswerKeyId, targetQuestionPaperId],
      );
      linkedAnswerKeys += 1;
    }

    const manifest: PromotionManifest = {
      generatedAt: new Date().toISOString(),
      sourceDatabaseUrlHost: new URL(options.sourceDatabaseUrl).host,
      targetDatabaseUrlHost: new URL(options.targetDatabaseUrl).host,
      filters: {
        dryRun: options.dryRun,
        courseCodes: options.courseCodes,
        limit: options.limit,
        requireVerified: options.requireVerified,
        createOnly: options.createOnly,
        failOnTargetDuplicates: options.failOnTargetDuplicates,
        createdAfter: options.createdAfter?.toISOString() ?? null,
      },
      summary: {
        sourcePapers: mappedSourcePapers.length,
        created,
        updated,
        skipped,
        skippedExisting,
        skippedUnverified,
        blocked,
        blockedMissingMetadata,
        blockedTargetDuplicates,
        targetDuplicateKeys: targetDuplicateKeys.size,
        linkedAnswerKeys,
      },
      touchedPapers,
      records,
    };

    await ensureReportDir();
    const stamp = timestamp();
    const jsonPath =
      options.outputManifestFile ?? path.join(REPORT_DIR, `prod-paper-promotion-${stamp}.json`);
    const mdPath = options.outputMarkdownFile ?? path.join(REPORT_DIR, `prod-paper-promotion-${stamp}.md`);
    await writeFile(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await writeFile(mdPath, buildMarkdown(manifest), "utf8");

    if (options.failOnBlocked && manifest.summary.blocked > 0) {
      throw new Error(
        `Promotion blocked for ${manifest.summary.blocked} source paper(s). See ${jsonPath} for details.`,
      );
    }

    console.log(
      JSON.stringify(
        {
          manifest: jsonPath,
          markdown: mdPath,
          summary: manifest.summary,
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.allSettled([source.close(), target.close()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
