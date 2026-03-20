const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("../src/generated/prisma");

const prisma = new PrismaClient();
const REPORT_DIR = path.resolve(__dirname, "reports");

const TAGS_BY_LABEL = {
  "CAT-1": { slug: "cat-1", aliases: ["cat1", "cat 1", "cat-1"] },
  "CAT-2": { slug: "cat-2", aliases: ["cat2", "cat 2", "cat-2"] },
  FAT: { slug: "fat", aliases: ["fat"] },
};

function detectExamTag(title) {
  const normalized = String(title || "").toLowerCase();
  if (/\bcat[-\s]?1\b/i.test(normalized)) return "CAT-1";
  if (/\bcat[-\s]?2\b/i.test(normalized)) return "CAT-2";
  if (/\bfat(?:\s*2)?\b/i.test(normalized)) return "FAT";
  return null;
}

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

function mergeAliases(existingAliases, canonicalAliases) {
  const seen = new Set();
  const merged = [];

  for (const alias of [...(existingAliases || []), ...(canonicalAliases || [])]) {
    const value = String(alias || "").trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    merged.push(value);
  }

  return merged;
}

function createExamTypeCounter() {
  return Object.fromEntries(Object.keys(TAGS_BY_LABEL).map((label) => [label, 0]));
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

async function ensureExamTags() {
  const labels = Object.keys(TAGS_BY_LABEL);
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

  const tags = await Promise.all(
    labels.map((name) => {
      const existing = existingByName.get(name);
      const canonicalAliases = TAGS_BY_LABEL[name].aliases;
      if (existing) {
        return prisma.tag.update({
          where: { id: existing.id },
          data: { aliases: mergeAliases(existing.aliases, canonicalAliases) },
          select: { id: true, name: true },
        });
      }
      return prisma.tag.create({
        data: { name, aliases: canonicalAliases },
        select: { id: true, name: true },
      });
    }),
  );
  return new Map(tags.map((tag) => [tag.name, tag.id]));
}

async function getExistingExamTags() {
  const labels = Object.keys(TAGS_BY_LABEL);
  const tags = await prisma.tag.findMany({
    where: {
      name: {
        in: labels,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });
  return new Map(tags.map((tag) => [tag.name, tag.id]));
}

async function getExamTagsForRun({ dryRun }) {
  if (!dryRun) {
    return ensureExamTags();
  }

  const existingTags = await getExistingExamTags();
  const labels = Object.keys(TAGS_BY_LABEL);

  return new Map(
    labels.map((label) => [label, existingTags.get(label) ?? `dry-run:${label}`]),
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const examTags = await getExamTagsForRun({ dryRun });
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
    const detectedLabel = detectExamTag(paper.title);
    if (!detectedLabel) {
      unmatched += 1;
      rows.push({
        status: "unmatched",
        paperId: paper.id,
        title: paper.title,
        detectedLabel: null,
        currentExamTags: paper.tags
          .filter((tag) => TAGS_BY_LABEL[tag.name])
          .map((tag) => tag.name),
        allTags: formatTagList(paper.tags),
      });
      continue;
    }

    const currentExamTags = paper.tags.filter((tag) => TAGS_BY_LABEL[tag.name]);
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
        .filter((tag) => !TAGS_BY_LABEL[tag.name])
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
