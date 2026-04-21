const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("../src/generated/prisma");
const {
  EXAM_TAGS,
  canonicalizeExamTag,
  createExamTypeCounter,
  detectExamTagFromTitle,
  mergeAliases,
} = require("./lib/past-paper-exam-tags");

const prisma = new PrismaClient();
const REPORT_DIR = path.resolve(__dirname, "reports");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function formatTagList(tags) {
  if (!tags.length) return "(none)";
  return tags.map((tag) => tag.name).sort().join(", ");
}

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function writeReport({ dryRun, rows, summary }) {
  ensureReportDir();
  const stamp = timestamp();
  const mode = dryRun ? "dry-run" : "apply";
  const baseName = `backfill-past-paper-exam-tags-${mode}-${stamp}`;
  const markdownPath = path.join(REPORT_DIR, `${baseName}.md`);
  const jsonPath = path.join(REPORT_DIR, `${baseName}.json`);

  const matched = rows.filter((row) => row.status === "would_update" || row.status === "updated");
  const alreadyCorrect = rows.filter((row) => row.status === "already_correct");
  const unmatched = rows.filter((row) => row.status === "unmatched");
  const missingTargetTag = rows.filter((row) => row.status === "missing_target_tag");

  const section = (title, items, formatter) => {
    const lines = [`## ${title}`, ""];
    if (!items.length) {
      lines.push("_None_", "");
      return lines.join("\n");
    }
    items.forEach((item, index) => {
      lines.push(`${index + 1}. ${formatter(item)}`, "");
    });
    return lines.join("\n");
  };

  const markdown = [
    "# Past Paper Exam Tag Backfill Report",
    "",
    `Mode: ${dryRun ? "dry run" : "apply"}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Total papers scanned: ${summary.total}`,
    `- ${dryRun ? "Would update" : "Updated"}: ${summary.updated}`,
    `- Already correct / skipped: ${summary.skipped}`,
    `- Unmatched: ${summary.unmatched}`,
    `- Missing canonical tag rows: ${summary.missingTargetTagCount}`,
    `- Canonical tags ${dryRun ? "to create" : "created"}: ${summary.examTagsToCreate.join(", ") || "(none)"}`,
    `- Canonical tags ${dryRun ? "to update aliases" : "updated aliases"}: ${summary.examTagsToUpdateAliases.join(", ") || "(none)"}`,
    `- Newly tagged as CAT-1: ${summary.newlyTaggedByExamType["CAT-1"]}`,
    `- Newly tagged as CAT-2: ${summary.newlyTaggedByExamType["CAT-2"]}`,
    `- Newly tagged as FAT: ${summary.newlyTaggedByExamType.FAT}`,
    `- Total matched as CAT-1: ${summary.totalMatchedByExamType["CAT-1"]}`,
    `- Total matched as CAT-2: ${summary.totalMatchedByExamType["CAT-2"]}`,
    `- Total matched as FAT: ${summary.totalMatchedByExamType.FAT}`,
    "",
    section(
      dryRun ? "Would Update" : "Updated",
      matched,
      (row) =>
        `\`${row.paperId}\` -> **${row.detectedLabel}**  
Title: ${row.title}  
Current exam tags: ${row.currentExamTags.length ? row.currentExamTags.join(", ") : "(none)"}  
All current tags: ${row.allTags}`,
    ),
    section(
      "Already Correct / Skipped",
      alreadyCorrect,
      (row) =>
        `\`${row.paperId}\` already has **${row.detectedLabel}**  
Title: ${row.title}  
All current tags: ${row.allTags}`,
    ),
    section(
      "Unmatched",
      unmatched,
      (row) =>
        `\`${row.paperId}\` had no exam-type match  
Title: ${row.title}  
All current tags: ${row.allTags}`,
    ),
    section(
      "Missing Canonical Tag Rows",
      missingTargetTag,
      (row) =>
        `\`${row.paperId}\` could not be updated because the canonical tag row for **${row.detectedLabel}** was missing  
Title: ${row.title}`,
    ),
  ].join("\n");

  fs.writeFileSync(markdownPath, markdown);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dryRun,
        summary,
        rows,
      },
      null,
      2,
    ),
  );

  return { markdownPath, jsonPath };
}

async function getExamTagSetup({ dryRun }) {
  const labels = EXAM_TAGS.map((tag) => tag.label);
  const existingTags = await prisma.tag.findMany({
    where: {
      name: {
        in: labels,
      },
    },
    select: {
      id: true,
      name: true,
      aliases: true,
    },
  });
  const existingByName = new Map(existingTags.map((tag) => [tag.name, tag]));
  const tagIds = new Map();
  const examTagsToCreate = [];
  const examTagsToUpdateAliases = [];

  for (const tagConfig of EXAM_TAGS) {
    const { label, aliases } = tagConfig;
    const existing = existingByName.get(label);

    if (!existing) {
      examTagsToCreate.push(label);
      if (dryRun) {
        tagIds.set(label, `dry-run:${label}`);
        continue;
      }

      const tag = await prisma.tag.create({
        data: { name: label, aliases },
        select: { id: true, name: true },
      });
      tagIds.set(tag.name, tag.id);
      continue;
    }

    const mergedAliases = mergeAliases(existing.aliases, aliases);
    const needsAliasUpdate = mergedAliases.length !== existing.aliases.length;
    if (needsAliasUpdate) {
      examTagsToUpdateAliases.push(label);
    }

    if (!dryRun && needsAliasUpdate) {
      await prisma.tag.update({
        where: { id: existing.id },
        data: { aliases: mergedAliases },
      });
    }

    tagIds.set(label, existing.id);
  }

  return { tagIds, examTagsToCreate, examTagsToUpdateAliases };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const {
    tagIds: examTags,
    examTagsToCreate,
    examTagsToUpdateAliases,
  } = await getExamTagSetup({ dryRun });
  const papers = await prisma.pastPaper.findMany({
    select: {
      id: true,
      title: true,
      tags: { select: { id: true, name: true } },
    },
  });

  let updated = 0;
  let skipped = 0;
  let unmatched = 0;
  let missingTargetTagCount = 0;
  const newlyTaggedByExamType = createExamTypeCounter();
  const totalMatchedByExamType = createExamTypeCounter();
  const rows = [];

  for (const paper of papers) {
    const detectedLabel = detectExamTagFromTitle(paper.title);
    if (!detectedLabel) {
      unmatched += 1;
      rows.push({
        status: "unmatched",
        paperId: paper.id,
        title: paper.title,
        detectedLabel: null,
        currentExamTags: paper.tags
          .filter((tag) => canonicalizeExamTag(tag.name))
          .map((tag) => tag.name),
        allTags: formatTagList(paper.tags),
      });
      continue;
    }

    const currentExamTags = paper.tags.filter((tag) =>
      canonicalizeExamTag(tag.name),
    );
    const targetId = examTags.get(detectedLabel);
    if (!targetId) {
      skipped += 1;
      missingTargetTagCount += 1;
      rows.push({
        status: "missing_target_tag",
        paperId: paper.id,
        title: paper.title,
        detectedLabel,
        currentExamTags: currentExamTags.map((tag) => tag.name),
        allTags: formatTagList(paper.tags),
      });
      continue;
    }

    totalMatchedByExamType[detectedLabel] += 1;

    const nextTagIds = [
      ...paper.tags
        .filter((tag) => !canonicalizeExamTag(tag.name))
        .map((tag) => tag.id),
      targetId,
    ];

    const alreadyCorrect =
      currentExamTags.length === 1 && currentExamTags[0].name === detectedLabel;

    if (alreadyCorrect) {
      skipped += 1;
      rows.push({
        status: "already_correct",
        paperId: paper.id,
        title: paper.title,
        detectedLabel,
        currentExamTags: currentExamTags.map((tag) => tag.name),
        allTags: formatTagList(paper.tags),
      });
      continue;
    }

    if (dryRun) {
      updated += 1;
      newlyTaggedByExamType[detectedLabel] += 1;
      rows.push({
        status: "would_update",
        paperId: paper.id,
        title: paper.title,
        detectedLabel,
        currentExamTags: currentExamTags.map((tag) => tag.name),
        allTags: formatTagList(paper.tags),
      });
      continue;
    }

    await prisma.pastPaper.update({
      where: { id: paper.id },
      data: {
        tags: {
          set: nextTagIds.map((id) => ({ id })),
        },
      },
    });
    console.log(`Updated ${paper.id} -> ${detectedLabel}`);
    updated += 1;
    newlyTaggedByExamType[detectedLabel] += 1;
    rows.push({
      status: "updated",
      paperId: paper.id,
      title: paper.title,
      detectedLabel,
      currentExamTags: currentExamTags.map((tag) => tag.name),
      allTags: formatTagList(paper.tags),
    });
  }

  const summary = {
    total: papers.length,
    updated,
    skipped,
    unmatched,
    missingTargetTagCount,
    examTagsToCreate,
    examTagsToUpdateAliases,
    newlyTaggedByExamType,
    totalMatchedByExamType,
    dryRun,
  };
  const reportPaths = writeReport({ dryRun, rows, summary });

  console.log(
    JSON.stringify(
      {
        ...summary,
        report: reportPaths,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Failed to backfill past paper exam tags:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
