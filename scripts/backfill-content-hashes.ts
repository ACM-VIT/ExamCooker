import "dotenv/config";

import { and, asc, eq, isNull } from "drizzle-orm";
import { note, pastPaper } from "../db";
import { fetchModerationPdf, pdfContentHash } from "../lib/ai/moderation-pdf";
import { mapWithConcurrency } from "../lib/async/map-with-concurrency";
import { createScriptDb } from "./lib/db";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");

function readPositiveArgument(name: string, fallback: number) {
  const raw = [...args].find((arg) => arg.startsWith(`${name}=`))?.split("=")[1];
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const concurrency = readPositiveArgument("--concurrency", 2);
const limit = readPositiveArgument("--limit", 1_000_000);

async function main() {
  const { db, close } = createScriptDb();

  try {
    const notes = await db
      .select({
        id: note.id,
        fileUrl: note.fileUrl,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      })
      .from(note)
      .where(and(isNull(note.contentHash), isNull(note.moderationArchivedAt)))
      .orderBy(asc(note.createdAt))
      .limit(limit);
    const papers = await db
      .select({
        id: pastPaper.id,
        fileUrl: pastPaper.fileUrl,
        createdAt: pastPaper.createdAt,
        updatedAt: pastPaper.updatedAt,
      })
      .from(pastPaper)
      .where(
        and(
          isNull(pastPaper.contentHash),
          isNull(pastPaper.moderationArchivedAt),
        ),
      )
      .orderBy(asc(pastPaper.createdAt))
      .limit(limit);
    const resources = [
      ...notes.map((resource) => ({ ...resource, type: "note" as const })),
      ...papers.map((resource) => ({ ...resource, type: "pastPaper" as const })),
    ]
      .sort(
        (left, right) =>
          left.createdAt.getTime() - right.createdAt.getTime() ||
          left.id.localeCompare(right.id),
      )
      .slice(0, limit);

    console.log(
      JSON.stringify(
        {
          apply,
          concurrency,
          pendingNotes: notes.length,
          pendingPastPapers: papers.length,
          selected: resources.length,
        },
        null,
        2,
      ),
    );
    if (!apply || resources.length === 0) return;

    let completed = 0;
    const results = await mapWithConcurrency(resources, concurrency, async (resource) => {
      try {
        const contentHash = pdfContentHash(
          await fetchModerationPdf(resource.fileUrl),
        );
        const [updated] =
          resource.type === "note"
            ? await db
                .update(note)
                .set({ contentHash, updatedAt: resource.updatedAt })
                .where(
                  and(
                    eq(note.id, resource.id),
                    eq(note.updatedAt, resource.updatedAt),
                    isNull(note.contentHash),
                  ),
                )
                .returning({ id: note.id })
            : await db
                .update(pastPaper)
                .set({ contentHash, updatedAt: resource.updatedAt })
                .where(
                  and(
                    eq(pastPaper.id, resource.id),
                    eq(pastPaper.updatedAt, resource.updatedAt),
                    isNull(pastPaper.contentHash),
                  ),
                )
                .returning({ id: pastPaper.id });
        return updated ? "updated" : "skipped";
      } catch (error) {
        console.error(
          `[content-hash] ${resource.type} ${resource.id}:`,
          error instanceof Error ? error.message : error,
        );
        return "failed";
      } finally {
        completed += 1;
        if (completed % 25 === 0 || completed === resources.length) {
          console.log(`[content-hash] ${completed}/${resources.length}`);
        }
      }
    });

    console.log(
      JSON.stringify(
        {
          updated: results.filter((result) => result === "updated").length,
          skipped: results.filter((result) => result === "skipped").length,
          failed: results.filter((result) => result === "failed").length,
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
