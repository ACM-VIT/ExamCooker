const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const REPORT_DIR = path.resolve(__dirname, "reports");

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true, quiet: true });

let prismaPromise;
function getPrisma() {
  prismaPromise ??= (async () => {
    const [{ default: prismaClient }, { PrismaPg }] = await Promise.all([
      import("../prisma/generated/client.ts"),
      import("@prisma/adapter-pg"),
    ]);
    const { PrismaClient } = prismaClient;
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set.");
    }
    return new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  })();
  return prismaPromise;
}

// Inlined from lib/courseTags.ts — keep in sync if that regex changes.
const COURSE_TAG_REGEX = /^(.*?)\s*\[([A-Z]{2,7}\s?\d{2,5}[A-Z]{0,3})\]\s*$/i;

function normalizeCourseCode(code) {
  return String(code || "").replace(/\s+/g, "").toUpperCase();
}

function extractCourseFromTag(tagName) {
  const trimmed = String(tagName || "").trim();
  const match = trimmed.match(COURSE_TAG_REGEX);
  if (!match || !match[2]) return null;
  const code = normalizeCourseCode(match[2]);
  const title = (match[1] || "").trim() || code;
  return { code, title };
}

// Load COURSE_ACRONYMS from the TS source by stripping the type annotation
// and evaluating the object literal. Safe because this is our own file.
function loadCourseAcronyms() {
  const filePath = path.resolve(__dirname, "..", "lib", "course-map.ts");
  const source = fs.readFileSync(filePath, "utf8");
  const anchor = source.indexOf("COURSE_ACRONYMS");
  if (anchor === -1) {
    throw new Error("Could not locate COURSE_ACRONYMS declaration in lib/course-map.ts");
  }
  const equalsIdx = source.indexOf("=", anchor);
  if (equalsIdx === -1) {
    throw new Error("Could not locate `=` after COURSE_ACRONYMS");
  }
  const openIdx = source.indexOf("{", equalsIdx);
  if (openIdx === -1) {
    throw new Error("Could not locate opening brace of COURSE_ACRONYMS literal");
  }
  // Balanced-brace walk to find the matching close.
  let depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        closeIdx = i;
        break;
      }
    }
  }
  if (closeIdx === -1) {
    throw new Error("Could not find matching close brace for COURSE_ACRONYMS literal");
  }
  const literal = source.slice(openIdx, closeIdx + 1);
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${literal});`)();
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function formatAliasList(aliases) {
  if (!aliases.length) return "_none_";
  return aliases.map((a) => `\`${a}\``).join(", ");
}

function writeReport({ dryRun, summary, rows, conflicts, ignoredTags }) {
  ensureReportDir();
  const stamp = timestamp();
  const mode = dryRun ? "dry-run" : "apply";
  const baseName = `seed-courses-${mode}-${stamp}`;
  const markdownPath = path.join(REPORT_DIR, `${baseName}.md`);
  const jsonPath = path.join(REPORT_DIR, `${baseName}.json`);

  const section = (title, items, formatter) => {
    const lines = [`## ${title}`, ""];
    if (!items.length) {
      lines.push("_None_", "");
      return lines.join("\n");
    }
    items.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${formatter(item)}`, "");
    });
    return lines.join("\n");
  };

  const markdown = [
    "# Course Seed Report",
    "",
    `Mode: ${dryRun ? "dry run" : "apply"}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Total unique course codes: ${summary.totalCodes}`,
    `- Courses to ${dryRun ? "create" : "created"}: ${summary.toCreate}`,
    `- Courses ${dryRun ? "would skip" : "skipped"} (already exist): ${summary.toSkip}`,
    `- Title conflicts detected: ${conflicts.length}`,
    `- Tags ignored (did not match course regex): ${ignoredTags.length}`,
    "",
    section(
      dryRun ? "Courses to create" : "Courses created",
      rows.filter((r) => r.status === "create"),
      (r) =>
        `**${r.code}** — ${r.title}  \n` +
        `  Aliases: ${formatAliasList(r.aliases)}  \n` +
        `  Usage (notes + papers + forum posts): ${r.usage}  \n` +
        `  Contributing tags: ${formatAliasList(r.tagNames)}`,
    ),
    section(
      dryRun ? "Courses would skip (already exist)" : "Courses skipped (already exist)",
      rows.filter((r) => r.status === "skip"),
      (r) => `**${r.code}** — ${r.title} (existing aliases kept)`,
    ),
    section(
      "Title conflicts",
      conflicts,
      (c) =>
        `**${c.code}** had multiple candidate titles:  \n` +
        c.candidates
          .map(
            (cand) =>
              `  - "${cand.title}" (usage ${cand.usage}, from tags: ${formatAliasList(cand.tagNames)})`,
          )
          .join("\n") +
        `\n  → chose: **${c.chosenTitle}**`,
    ),
    section(
      "Ignored tags",
      ignoredTags.slice(0, 200),
      (t) => `\`${t.name}\` — usage ${t.usage}`,
    ),
    ignoredTags.length > 200
      ? `\n_(showing first 200 of ${ignoredTags.length} ignored tags)_\n`
      : "",
  ].join("\n");

  fs.writeFileSync(markdownPath, markdown);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ summary, rows, conflicts, ignoredTags }, null, 2),
  );
  console.log(`\nReport written to:`);
  console.log(`  ${markdownPath}`);
  console.log(`  ${jsonPath}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = await getPrisma();

  console.log(`Running course seed (${dryRun ? "dry-run" : "apply"} mode)...`);

  const acronyms = loadCourseAcronyms();
  // Invert: { CODE: [aliasString, ...] }
  const aliasesByCode = new Map();
  for (const [alias, codes] of Object.entries(acronyms)) {
    for (const rawCode of codes) {
      const code = normalizeCourseCode(rawCode);
      if (!aliasesByCode.has(code)) aliasesByCode.set(code, new Set());
      aliasesByCode.get(code).add(alias);
    }
  }

  const tags = await prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          notes: true,
          pastPapers: true,
          forumPosts: true,
        },
      },
    },
  });

  // Group by normalized code.
  // groups: Map<code, { candidates: Map<title, { usage, tagNames: Set<string> }>, aliasTagNames: Set<string> }>
  const groups = new Map();
  const ignoredTags = [];

  for (const tag of tags) {
    const info = extractCourseFromTag(tag.name);
    const usage = tag._count.notes + tag._count.pastPapers + tag._count.forumPosts;
    if (!info) {
      ignoredTags.push({ name: tag.name, usage });
      continue;
    }
    const code = info.code;
    if (!groups.has(code)) {
      groups.set(code, {
        candidates: new Map(),
        aliasTagNames: new Set(),
      });
    }
    const group = groups.get(code);
    const existing = group.candidates.get(info.title) || {
      usage: 0,
      tagNames: new Set(),
    };
    existing.usage += usage;
    existing.tagNames.add(tag.name);
    group.candidates.set(info.title, existing);
    group.aliasTagNames.add(tag.name);
  }

  // Build rows + conflicts.
  const rows = [];
  const conflicts = [];

  // Pull existing courses so we can detect skips.
  const existing = await prisma.course.findMany({
    select: { id: true, code: true, title: true, aliases: true },
  });
  const existingByCode = new Map(existing.map((c) => [c.code, c]));

  const sortedCodes = Array.from(groups.keys()).sort();
  for (const code of sortedCodes) {
    const group = groups.get(code);
    // Rank candidate titles by usage (desc), then alphabetical for stability.
    const candidateEntries = Array.from(group.candidates.entries())
      .map(([title, data]) => ({
        title,
        usage: data.usage,
        tagNames: Array.from(data.tagNames).sort(),
      }))
      .sort((a, b) => {
        if (b.usage !== a.usage) return b.usage - a.usage;
        return a.title.localeCompare(b.title);
      });

    const chosen = candidateEntries[0];
    const chosenTitle = chosen.title;

    // Aliases = all tag names for this code (the `"Title [CODE]"` strings)
    // + any COURSE_ACRONYMS entries that map to this code.
    const aliasSet = new Set();
    for (const tagName of group.aliasTagNames) aliasSet.add(tagName);
    for (const acronym of aliasesByCode.get(code) || []) aliasSet.add(acronym);
    // Don't include the chosen title itself as an alias (it's already `course.title`).
    aliasSet.delete(chosenTitle);
    const aliases = Array.from(aliasSet).sort();

    // Title conflict: more than one distinct title, and the runner-up has non-trivial usage.
    const distinctTitles = candidateEntries.filter((c) => c.title !== chosenTitle);
    if (distinctTitles.length > 0) {
      const significant = distinctTitles.some(
        (c) => c.usage > 0 && c.title.toLowerCase() !== chosenTitle.toLowerCase(),
      );
      if (significant) {
        conflicts.push({
          code,
          chosenTitle,
          candidates: candidateEntries.map((c) => ({
            title: c.title,
            usage: c.usage,
            tagNames: c.tagNames,
          })),
        });
      }
    }

    const totalUsage = candidateEntries.reduce((sum, c) => sum + c.usage, 0);
    const existingRow = existingByCode.get(code);

    rows.push({
      status: existingRow ? "skip" : "create",
      code,
      title: chosenTitle,
      aliases,
      usage: totalUsage,
      tagNames: Array.from(group.aliasTagNames).sort(),
    });
  }

  const summary = {
    totalCodes: rows.length,
    toCreate: rows.filter((r) => r.status === "create").length,
    toSkip: rows.filter((r) => r.status === "skip").length,
  };

  if (!dryRun) {
    console.log(`\nUpserting ${summary.toCreate} new courses, touching ${summary.toSkip} existing...`);
    let i = 0;
    for (const row of rows) {
      if (row.status === "create") {
        await prisma.course.create({
          data: { code: row.code, title: row.title, aliases: row.aliases },
        });
      } else {
        // Merge aliases into the existing row; do not overwrite a human-edited title.
        const existing = existingByCode.get(row.code);
        const merged = Array.from(new Set([...(existing.aliases || []), ...row.aliases])).sort();
        await prisma.course.update({
          where: { id: existing.id },
          data: { aliases: merged },
        });
      }
      i++;
      if (i % 50 === 0) console.log(`  ${i}/${rows.length}`);
    }
    console.log(`Done.`);
  }

  writeReport({ dryRun, summary, rows, conflicts, ignoredTags });

  console.log(`\nSummary:`);
  console.log(`  Total codes:     ${summary.totalCodes}`);
  console.log(`  To create:       ${summary.toCreate}`);
  console.log(`  To skip:         ${summary.toSkip}`);
  console.log(`  Title conflicts: ${conflicts.length}`);
  console.log(`  Ignored tags:    ${ignoredTags.length}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const prisma = await getPrisma();
    await prisma.$disconnect();
  });
