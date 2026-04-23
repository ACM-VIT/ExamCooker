const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@/prisma/generated/client");

const prisma = new PrismaClient();
const REPORT_DIR = path.resolve(__dirname, "reports");
const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Parsing helpers (inlined from lib/courseTags.ts + lib/paperTitle.ts).
// Keep in sync if those change.
// ---------------------------------------------------------------------------

const COURSE_TAG_REGEX = /^(.*?)\s*\[([A-Z]{2,7}\s?\d{2,5}[A-Z]{0,3})\]\s*$/i;
const SLOT_REGEX = /\b([A-G][1-2])\b/i;
const YEAR_RANGE_REGEX = /\b((?:20)?\d{2})\s*-\s*((?:20)?\d{2})\b/;
const YEAR_REGEX = /\b(20\d{2})\b/;
const COURSE_CODE_REGEX = /([A-Z]{2,7}\d{2,5}[A-Z]{0,3})/g;

function normalizeCourseCode(code) {
  return String(code || "").replace(/\s+/g, "").toUpperCase();
}

function extractCourseFromTag(tagName) {
  const trimmed = String(tagName || "").trim();
  const match = trimmed.match(COURSE_TAG_REGEX);
  if (!match || !match[2]) return null;
  return { code: normalizeCourseCode(match[2]), title: (match[1] || "").trim() };
}

function extractCourseCodeFromTitle(title) {
  let lastMatch;
  let m;
  const re = new RegExp(COURSE_CODE_REGEX.source, "g");
  const upper = String(title || "").toUpperCase();
  while ((m = re.exec(upper)) !== null) lastMatch = m[1];
  return lastMatch ? normalizeCourseCode(lastMatch) : null;
}

function extractExamType(title) {
  const t = String(title || "");
  if (/\bmodel\s+cat[-\s]?1\b/i.test(t)) return "MODEL_CAT_1";
  if (/\bmodel\s+cat[-\s]?2\b/i.test(t)) return "MODEL_CAT_2";
  if (/\bmodel\s+fat\b/i.test(t)) return "MODEL_FAT";
  if (/\bcat[-\s]?1\b/i.test(t)) return "CAT_1";
  if (/\bcat[-\s]?2\b/i.test(t)) return "CAT_2";
  if (/\bfat(?:\s*2)?\b/i.test(t)) return "FAT";
  if (/\bmid(?:term)?\b/i.test(t)) return "MID";
  if (/\bquiz\b/i.test(t)) return "QUIZ";
  if (/\bcia\b/i.test(t)) return "CIA";
  return null;
}

function extractSlot(title) {
  const m = String(title || "").match(SLOT_REGEX);
  return m ? m[1].toUpperCase() : null;
}

function extractYear(title) {
  const t = String(title || "");
  const range = t.match(YEAR_RANGE_REGEX);
  if (range) {
    const start = normalizeYear(range[1]);
    if (start) return Number(start);
  }
  const single = t.match(YEAR_REGEX);
  if (single) {
    const y = normalizeYear(single[1]);
    if (y) return Number(y);
  }
  return null;
}

function normalizeYear(value) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 4) return digits;
  if (digits.length === 2) {
    const parsed = parseInt(digits, 10);
    if (!Number.isNaN(parsed)) return String(2000 + parsed);
  }
  return null;
}

function isSlotTagName(name) {
  return /^[A-G][1-2]$/i.test(String(name || "").trim());
}

// ---------------------------------------------------------------------------
// Report helpers
// ---------------------------------------------------------------------------

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function writeReport({ dryRun, summary, samples }) {
  ensureReportDir();
  const stamp = timestamp();
  const mode = dryRun ? "dry-run" : "apply";
  const baseName = `backfill-paper-metadata-${mode}-${stamp}`;
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

  const md = [
    "# Paper/Note Metadata Backfill Report",
    "",
    `Mode: ${dryRun ? "dry run" : "apply"}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Papers summary",
    "",
    `- Total papers scanned: ${summary.papers.total}`,
    `- Would update / updated: ${summary.papers.toUpdate}`,
    `- Skipped (already fully resolved or idempotent): ${summary.papers.skipped}`,
    "",
    `- Course resolved (tag exact): ${summary.papers.courseResolvedTag}`,
    `- Course resolved (title fallback): ${summary.papers.courseResolvedTitleFallback}`,
    `- Course ambiguous (kept null): ${summary.papers.courseAmbiguous}`,
    `- Course unresolved: ${summary.papers.courseUnresolved}`,
    "",
    "### Exam type distribution",
    "",
    Object.entries(summary.papers.examTypeHistogram)
      .map(([type, count]) => `- ${type}: ${count}`)
      .join("\n"),
    "",
    `- examType left null: ${summary.papers.examTypeNull}`,
    `- year left null: ${summary.papers.yearNull}`,
    `- slot populated: ${summary.papers.slotFilled}`,
    "",
    "## Papers — incomplete rows that will surface in mod review queue",
    "",
    `${summary.papers.incomplete} papers have at least one of (courseId, examType, year) null after backfill.`,
    "",
    "## Notes summary",
    "",
    `- Total notes scanned: ${summary.notes.total}`,
    `- Would update / updated: ${summary.notes.toUpdate}`,
    `- Skipped: ${summary.notes.skipped}`,
    `- Course resolved (tag): ${summary.notes.courseResolvedTag}`,
    `- Course unresolved: ${summary.notes.courseUnresolved}`,
    "",
    section(
      "Sample — papers with ambiguous course match",
      samples.paperAmbiguous,
      (s) =>
        `\`${s.id}\` — "${s.title}"  \n` +
        `  Candidate courses: ${s.candidates.map((c) => `${c.code}×${c.count}`).join(", ")}`,
    ),
    section(
      "Sample — papers with no course match",
      samples.paperNoCourse,
      (s) =>
        `\`${s.id}\` — "${s.title}"  \n` +
        `  Tags: ${s.tagNames.join(", ") || "(none)"}`,
    ),
    section(
      "Sample — papers with course but missing examType/year",
      samples.paperMissingExamOrYear,
      (s) =>
        `\`${s.id}\` — "${s.title}"  \n` +
        `  course=${s.code} examType=${s.examType ?? "null"} year=${s.year ?? "null"}`,
    ),
    section(
      "Sample — notes with no course match",
      samples.noteNoCourse,
      (s) =>
        `\`${s.id}\` — "${s.title}"  \n` +
        `  Tags: ${s.tagNames.join(", ") || "(none)"}`,
    ),
  ].join("\n");

  fs.writeFileSync(markdownPath, md);
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, samples }, null, 2));
  console.log(`\nReport written to:`);
  console.log(`  ${markdownPath}`);
  console.log(`  ${jsonPath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Running backfill (${dryRun ? "dry-run" : "apply"} mode)...`);

  // Build alias → courseId lookup. Aliases include all "Title [CODE]" tag names
  // and any entries from COURSE_ACRONYMS seeded into Course.aliases.
  const courses = await prisma.course.findMany({
    select: { id: true, code: true, aliases: true },
  });
  /** Map<normalizedKey, courseId> */
  const courseLookup = new Map();
  for (const c of courses) {
    courseLookup.set(c.code, c.id);
    for (const alias of c.aliases || []) {
      // Index by the raw alias string (case-sensitive match for the "Title [CODE]" form)
      courseLookup.set(alias, c.id);
      // Also index by the normalized code if the alias is itself a code
      const extracted = extractCourseFromTag(alias);
      if (extracted) courseLookup.set(extracted.code, c.id);
    }
  }
  console.log(`Loaded ${courses.length} courses (${courseLookup.size} lookup keys).`);

  // -------------------------------------------------------------------------
  // Papers
  // -------------------------------------------------------------------------

  const papers = await prisma.pastPaper.findMany({
    select: {
      id: true,
      title: true,
      courseId: true,
      examType: true,
      slot: true,
      year: true,
      tags: { select: { id: true, name: true } },
    },
  });
  console.log(`Loaded ${papers.length} papers.`);

  const paperSummary = {
    total: papers.length,
    toUpdate: 0,
    skipped: 0,
    courseResolvedTag: 0,
    courseResolvedTitleFallback: 0,
    courseAmbiguous: 0,
    courseUnresolved: 0,
    examTypeHistogram: {
      CAT_1: 0, CAT_2: 0, FAT: 0, MODEL_CAT_1: 0, MODEL_CAT_2: 0,
      MODEL_FAT: 0, MID: 0, QUIZ: 0, CIA: 0, OTHER: 0,
    },
    examTypeNull: 0,
    yearNull: 0,
    slotFilled: 0,
    incomplete: 0,
  };

  const paperUpdates = [];
  const samples = {
    paperAmbiguous: [],
    paperNoCourse: [],
    paperMissingExamOrYear: [],
    noteNoCourse: [],
  };

  for (const paper of papers) {
    // Idempotency: skip rows already fully resolved.
    const alreadyComplete =
      paper.courseId !== null &&
      paper.examType !== null &&
      paper.year !== null;
    if (alreadyComplete) {
      paperSummary.skipped++;
      continue;
    }

    const update = {};

    // ----- Course resolution -----
    if (paper.courseId === null) {
      const tagNames = paper.tags.map((t) => t.name);
      /** @type {Map<courseId, number>} */
      const candidateCounts = new Map();
      for (const tagName of tagNames) {
        let courseId = courseLookup.get(tagName);
        if (!courseId) {
          const extracted = extractCourseFromTag(tagName);
          if (extracted) courseId = courseLookup.get(extracted.code);
        }
        if (courseId) {
          candidateCounts.set(courseId, (candidateCounts.get(courseId) || 0) + 1);
        }
      }

      if (candidateCounts.size === 0) {
        // Try title fallback.
        const titleCode = extractCourseCodeFromTitle(paper.title);
        if (titleCode && courseLookup.has(titleCode)) {
          update.courseId = courseLookup.get(titleCode);
          paperSummary.courseResolvedTitleFallback++;
        } else {
          paperSummary.courseUnresolved++;
          if (samples.paperNoCourse.length < 30) {
            samples.paperNoCourse.push({
              id: paper.id,
              title: paper.title,
              tagNames,
            });
          }
        }
      } else if (candidateCounts.size === 1) {
        update.courseId = candidateCounts.keys().next().value;
        paperSummary.courseResolvedTag++;
      } else {
        // Ambiguous — pick majority if strict, else leave null.
        const sorted = Array.from(candidateCounts.entries()).sort((a, b) => b[1] - a[1]);
        if (sorted[0][1] > sorted[1][1]) {
          update.courseId = sorted[0][0];
          paperSummary.courseResolvedTag++;
        } else {
          paperSummary.courseAmbiguous++;
          if (samples.paperAmbiguous.length < 30) {
            const courseById = new Map(courses.map((c) => [c.id, c.code]));
            samples.paperAmbiguous.push({
              id: paper.id,
              title: paper.title,
              candidates: sorted.map(([cid, count]) => ({
                code: courseById.get(cid) || cid,
                count,
              })),
            });
          }
        }
      }
    }

    // ----- Exam type -----
    if (paper.examType === null) {
      const examType = extractExamType(paper.title);
      if (examType) {
        update.examType = examType;
        paperSummary.examTypeHistogram[examType]++;
      }
    }

    // ----- Slot -----
    if (paper.slot === null) {
      let slot = extractSlot(paper.title);
      if (!slot) {
        const slotTag = paper.tags.find((t) => isSlotTagName(t.name));
        if (slotTag) slot = slotTag.name.toUpperCase();
      }
      if (slot) {
        update.slot = slot;
      }
    }

    // ----- Year -----
    if (paper.year === null) {
      const year = extractYear(paper.title);
      if (year) update.year = year;
    }

    if (Object.keys(update).length > 0) {
      paperUpdates.push({ id: paper.id, data: update });
      paperSummary.toUpdate++;
    } else {
      paperSummary.skipped++;
    }

    // Post-state for incomplete tracking.
    const finalCourseId = update.courseId ?? paper.courseId;
    const finalExamType = update.examType ?? paper.examType;
    const finalYear = update.year ?? paper.year;
    const finalSlot = update.slot ?? paper.slot;
    if (finalExamType === null) paperSummary.examTypeNull++;
    if (finalYear === null) paperSummary.yearNull++;
    if (finalSlot !== null) paperSummary.slotFilled++;
    const incomplete = finalCourseId === null || finalExamType === null || finalYear === null;
    if (incomplete) paperSummary.incomplete++;
    if (
      finalCourseId !== null &&
      (finalExamType === null || finalYear === null) &&
      samples.paperMissingExamOrYear.length < 30
    ) {
      const courseById = new Map(courses.map((c) => [c.id, c.code]));
      samples.paperMissingExamOrYear.push({
        id: paper.id,
        title: paper.title,
        code: courseById.get(finalCourseId) || finalCourseId,
        examType: finalExamType,
        year: finalYear,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Notes
  // -------------------------------------------------------------------------

  const notes = await prisma.note.findMany({
    select: {
      id: true,
      title: true,
      courseId: true,
      tags: { select: { id: true, name: true } },
    },
  });
  console.log(`Loaded ${notes.length} notes.`);

  const noteSummary = {
    total: notes.length,
    toUpdate: 0,
    skipped: 0,
    courseResolvedTag: 0,
    courseUnresolved: 0,
  };

  const noteUpdates = [];

  for (const note of notes) {
    if (note.courseId !== null) {
      noteSummary.skipped++;
      continue;
    }
    const tagNames = note.tags.map((t) => t.name);
    const candidateCounts = new Map();
    for (const tagName of tagNames) {
      let courseId = courseLookup.get(tagName);
      if (!courseId) {
        const extracted = extractCourseFromTag(tagName);
        if (extracted) courseId = courseLookup.get(extracted.code);
      }
      if (courseId) {
        candidateCounts.set(courseId, (candidateCounts.get(courseId) || 0) + 1);
      }
    }

    let chosen = null;
    if (candidateCounts.size === 1) {
      chosen = candidateCounts.keys().next().value;
    } else if (candidateCounts.size > 1) {
      const sorted = Array.from(candidateCounts.entries()).sort((a, b) => b[1] - a[1]);
      if (sorted[0][1] > sorted[1][1]) chosen = sorted[0][0];
    }

    if (chosen) {
      noteUpdates.push({ id: note.id, data: { courseId: chosen } });
      noteSummary.toUpdate++;
      noteSummary.courseResolvedTag++;
    } else {
      noteSummary.courseUnresolved++;
      noteSummary.skipped++;
      if (samples.noteNoCourse.length < 30) {
        samples.noteNoCourse.push({ id: note.id, title: note.title, tagNames });
      }
    }
  }

  const summary = { papers: paperSummary, notes: noteSummary };

  // -------------------------------------------------------------------------
  // Apply (or skip if dry run)
  // -------------------------------------------------------------------------

  if (!dryRun) {
    console.log(`\nApplying ${paperUpdates.length} paper updates...`);
    let done = 0;
    for (let i = 0; i < paperUpdates.length; i += BATCH_SIZE) {
      const batch = paperUpdates.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((u) =>
          prisma.pastPaper.update({ where: { id: u.id }, data: u.data }),
        ),
      );
      done += batch.length;
      console.log(`  ${done}/${paperUpdates.length}`);
    }

    console.log(`\nApplying ${noteUpdates.length} note updates...`);
    done = 0;
    for (let i = 0; i < noteUpdates.length; i += BATCH_SIZE) {
      const batch = noteUpdates.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((u) =>
          prisma.note.update({ where: { id: u.id }, data: u.data }),
        ),
      );
      done += batch.length;
      console.log(`  ${done}/${noteUpdates.length}`);
    }
  }

  writeReport({ dryRun, summary, samples });

  console.log(`\n== Papers ==`);
  console.log(`  total:                ${paperSummary.total}`);
  console.log(`  updating:             ${paperSummary.toUpdate}`);
  console.log(`  skipped:              ${paperSummary.skipped}`);
  console.log(`  course (tag):         ${paperSummary.courseResolvedTag}`);
  console.log(`  course (title):       ${paperSummary.courseResolvedTitleFallback}`);
  console.log(`  course ambiguous:     ${paperSummary.courseAmbiguous}`);
  console.log(`  course unresolved:    ${paperSummary.courseUnresolved}`);
  console.log(`  examType null:        ${paperSummary.examTypeNull}`);
  console.log(`  year null:            ${paperSummary.yearNull}`);
  console.log(`  slot filled:          ${paperSummary.slotFilled}`);
  console.log(`  incomplete (review):  ${paperSummary.incomplete}`);
  console.log(`\n== Notes ==`);
  console.log(`  total:                ${noteSummary.total}`);
  console.log(`  updating:             ${noteSummary.toUpdate}`);
  console.log(`  skipped:              ${noteSummary.skipped}`);
  console.log(`  course resolved:      ${noteSummary.courseResolvedTag}`);
  console.log(`  course unresolved:    ${noteSummary.courseUnresolved}`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
